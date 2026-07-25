import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlannerService } from '../planner/planner.service';
import Groq from 'groq-sdk';
import { search } from 'duck-duck-scrape';

@Injectable()
export class AiService {
  private groq: Groq;

  constructor(
    private readonly prisma: PrismaService,
    private readonly plannerService: PlannerService,
  ) {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async handleChat(userId: string, playerTag: string, messages: any[]) {
    const formattedTag = playerTag.toUpperCase().trim();
    
    // Fetch the player account and related data to build the system prompt context
    const account = await this.prisma.playerAccount.findFirst({
      where: { player_tag: formattedTag, user_id: userId },
      include: {
        buildings: true,
        troops: true,
        heroes: true,
        planners: true,
      },
    });

    if (!account) {
      throw new NotFoundException(`Player tag ${formattedTag} not associated with this user`);
    }

    // Prepare village summary for the AI
    const villageSummary = `
User Town Hall Level: ${account.townhall_level}
Village Overview:
${account.buildings.map(b => `- ${b.name} Lvl ${b.level}`).join('\n')}
${account.troops.map(t => `- ${t.name} Lvl ${t.level}`).join('\n')}
${account.heroes.map(h => `- ${h.name} Lvl ${h.level}`).join('\n')}

Currently in Upgrade Planner:
${account.planners.length > 0 ? account.planners.map(p => `- ${p.item_name} to Lvl ${p.to_level}`).join('\n') : 'Nothing currently planned.'}
    `.trim();

    const systemPrompt = `You are VoltAI, an expert AI assistant for Clash of Clans, helping the user plan their upgrades. 
The user is Town Hall ${account.townhall_level}.
Here is the user's current village state:
${villageSummary}

Your goal is to answer their questions and suggest optimal upgrade paths. 
If the user asks you to add something to their plan, you MUST use the "add_to_upgrade_plan" tool.

CRITICAL STRATEGY KNOWLEDGE (TOWN HALL RUSHING & MERGING):
When a user asks about rushing or upgrading to the next Town Hall (especially TH16, TH17, TH18), you must inform them of the strict prerequisites:
- To upgrade from TH15 to TH16, they must weaponize their TH15 to Level 5.
- To upgrade from TH16 to TH17, they must complete 4 Merged Buildings (like Multi-Archer Towers or Ricochet Cannons) and weaponize their TH16 to Level 5.
- To upgrade from TH17 to TH18, they must complete 3 Merged Buildings, construct 2 completely new buildings, and weaponize their TH17 to Level 5.
Always provide these specific requirements if they mention rushing to TH17 or TH18. Do not give generic advice like "upgrade collectors" when they ask about Town Hall requirements.

CRITICAL FORMATTING RULES:
- NEVER output a giant wall of text.
- ALWAYS use bullet points and line breaks (\n) to separate your points.
- Keep sentences short and punchy.

INTERNET ACCESS:
You have access to the live internet via the "search_web" tool. Use it whenever the user asks for strategies, army compositions, base links, or anything meta-related.
If you use a tool to add an item, confirm to the user that you successfully added it.`;

    // Make sure we structure messages properly for Groq
    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }))
    ];

    const tools = [
      {
        type: 'function',
        function: {
          name: 'add_to_upgrade_plan',
          description: 'Adds an item (building, troop, hero, spell, equipment, etc.) to the user\'s upgrade planner.',
          parameters: {
            type: 'object',
            properties: {
              itemName: {
                type: 'string',
                description: 'The exact name of the item (e.g. "Archer Queen", "Cannon", "Hog Rider")',
              },
              fromLevel: {
                type: 'integer',
                description: 'The current level of the item to upgrade from.',
              },
              toLevel: {
                type: 'integer',
                description: 'The target level of the item after upgrade.',
              },
              priority: {
                type: 'integer',
                description: 'Priority score, default to 0.',
              }
            },
            required: ['itemName', 'fromLevel', 'toLevel'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_web',
          description: 'Search the live internet for information (e.g. Clash of Clans army strategies, base links).',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query (e.g. "best th16 army composition 2026 site:youtube.com" or "top th16 legend league armies")',
              }
            },
            required: ['query'],
          },
        },
      }
    ];

    const runner = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: groqMessages as any,
      tools: tools as any,
      tool_choice: 'auto',
      max_tokens: 1024,
    });

    const responseMessage = runner.choices[0].message;

    // Check if AI wanted to call a tool
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      
      // Append the assistant's message (which contains the tool calls) to the conversation history FIRST
      groqMessages.push(responseMessage as any);

      // Execute all tool calls
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.function.name === 'add_to_upgrade_plan') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            await this.plannerService.addUpgradePlan(userId, {
              playerTag: formattedTag,
              itemName: args.itemName,
              fromLevel: args.fromLevel,
              toLevel: args.toLevel,
              priority: args.priority || 0,
            });
            groqMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ success: true, message: "Item successfully added to the plan." }),
            } as any);
          } catch (e) {
            console.error('Failed to execute add_to_upgrade_plan tool:', e);
            groqMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ success: false, error: e.message }),
            } as any);
          }
        } else if (toolCall.function.name === 'search_web') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const searchResults = await search(args.query);
            // Take top 5 results to keep context size manageable
            const topResults = searchResults.results.slice(0, 5).map(r => ({
              title: r.title,
              description: r.description,
              url: r.url
            }));
            
            groqMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(topResults),
            } as any);
          } catch (e) {
            console.error('Failed to execute search_web tool:', e);
            groqMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ success: false, error: e.message }),
            } as any);
          }
        }
      }

      // Let the AI formulate a final text response with the tool outputs.

      const finalRunner = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages as any,
      });

      return finalRunner.choices[0].message;
    }

    return responseMessage;
  }
}
