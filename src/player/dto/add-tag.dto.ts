import { IsString, Matches } from 'class-validator';

export class AddTagDto {
  @IsString()
  @Matches(/^#[A-Z0-9]+$/, {
    message: 'Player tag must start with # followed by uppercase alphanumeric characters (e.g. #2PP)',
  })
  playerTag: string;
}
