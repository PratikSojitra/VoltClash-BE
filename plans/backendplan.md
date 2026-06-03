# 🤖 BACKEND AI AGENT PROMPT (COST-OPTIMIZED VERSION)

---

## 🧠 SYSTEM PROMPT

```txt
You are a senior backend developer.

Tech stack:
- NestJS (TypeScript)
- PostgreSQL
- Prisma ORM

Project:
Clash of Clans tracker + upgrade planner (Clash Ninja clone)

IMPORTANT ARCHITECTURE:

- Frontend already exists
- Static game data (cost, time, levels) is provided via JSON
- DO NOT fetch upgrade cost/time from external APIs
- Use JSON data for all calculations

Your job:
- Build backend APIs only
- Handle business logic
- Manage database
- Integrate Clash of Clans API

Rules:
- Write production-ready code
- No pseudo code
- Use proper module structure
- Use DTO validation
- Use Prisma properly
- Use transactions where needed

Output:
- Code only
- Include all files
```

---

# 🔐 MODULE 1 — AUTH

```txt
Create Auth module with:

- Register
- Login (JWT)
- Password hashing (bcrypt)

Database:
User:
- id
- username
- password_hash
- created_at

Deliver:
- Module
- Controller
- Service
- DTOs
- JWT guard
```

---

# 🏷 MODULE 2 — PLAYER TAGS

```txt
Create Player module:

Features:
- Add player tag
- List tags
- Delete tag

Validation:
- Tag format (#XXXX)

Database:
PlayerAccount:
- id
- user_id
- player_tag
- name
- townhall_level
- last_synced_at
```

---

# 📡 MODULE 3 — CLASH API SERVICE

```txt
Create Clash API service:

- Fetch player data by tag
- Use axios
- Use API key from env

Function:
getPlayerData(tag: string)

Handle:
- Invalid tag
- Rate limit
```

---

# 💾 MODULE 4 — PLAYER DATA STORAGE

```txt
Store:

- Raw API response
- Parsed:
  - Buildings
  - Troops
  - Heroes

Database:
PlayerData (raw_json)
Buildings
Troops
Heroes

Requirements:
- Normalize data
- Upsert on sync
```

---

# 🔄 MODULE 5 — SYNC SYSTEM

```txt
POST /player/sync/:id

Flow:
- Fetch from Clash API
- Update DB
- Update last_synced_at

Use transaction
```

---

# 🛠 MODULE 6 — UPGRADE SYSTEM

```txt
Manual upgrade system:

Features:
- Start upgrade
- Complete upgrade
- Cancel upgrade

IMPORTANT:
- DO NOT calculate time from API
- Use JSON data source

Input:
- item_name
- current_level

Logic:
- Read JSON
- Get upgrade time & cost
- Store start_time + end_time
```

---

# 📂 MODULE 7 — JSON DATA SERVICE (CRITICAL)

```txt
Create GameDataService

Purpose:
- Load static JSON data
- Provide functions:

getBuildingUpgrade(name, level)
getTroopUpgrade(name, level)

Data source:
- Local JSON files

Requirements:
- Cache in memory
- Fast lookup
```

---

# 🧠 MODULE 8 — UPGRADE PLANNER (CLASH NINJA CLONE)

```txt
Create Upgrade Planner:

Features:
- Plan upgrades
- Multi-level planning
- Priority system

IMPORTANT:
- Use JSON for cost/time

Database:
UpgradePlanner:
- id
- player_id
- item_name
- from_level
- to_level
- cost
- time_required
- priority
```

---

# 🧮 MODULE 9 — CALCULATION ENGINE

```txt
Create CalculationService:

Functions:
- calculateTotalCost(upgrades)
- calculateTotalTime(upgrades)

Logic:
- Read JSON data
- Sum values

No external API calls
```

---

# 🧱 MODULE 10 — BUILDER SYSTEM

```txt
Builder tracking:

- Assign builder
- Track availability

Database:
Builders:
- id
- player_id
- is_busy
- available_at
```

---

# ⚡ MODULE 11 — BOOST SYSTEM

```txt
Boost logic:

- Apply multiplier

Example:
Builder potion → 10x

Logic:
effective_time = base_time / multiplier
```

---

# 📥 MODULE 12 — JSON IMPORT

```txt
POST /player/import-json

- Accept village JSON
- Parse and update DB
```

---

# ⚙️ MODULE 13 — CRON JOBS

```txt
Use BullMQ:

Jobs:
- Auto complete upgrades
- Expire boosts
```

---

# 🚀 FINAL INSTRUCTION

```txt
Generate full backend system with:

- Auth
- Player tags
- Clash API integration
- Sync system
- Upgrade system (JSON-based)
- Planner (Clash Ninja clone)
- Builder system
- Calculation engine
- JSON import
- Cron jobs

Use clean modular NestJS structure.
```

---

# ✅ END
