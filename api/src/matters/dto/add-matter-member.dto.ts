export class AddMatterMemberDto {
  userId: string;
  memberRole?: string; // RESPONSIBLE/COLLAB/REVIEWER (default COLLAB)
}
