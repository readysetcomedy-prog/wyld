// Waiver content is stored as an array of blocks — cross-platform
// (renders with <Text>, edits with <TextInput>). No HTML.

export type WaiverBlock = {
  id: string;
  type: 'h2' | 'h3' | 'p' | 'bullet';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  size?: 'sm' | 'md' | 'lg';
};

export type WaiverBlockSeed = Omit<WaiverBlock, 'id'>;

let counter = 0;
export function newBlockId() {
  counter += 1;
  return `b${Date.now().toString(36)}_${counter}`;
}

export function withIds(seeds: WaiverBlockSeed[]): WaiverBlock[] {
  return seeds.map((s) => ({ ...s, id: newBlockId() }));
}

// Parse stored content into blocks. Handles legacy/empty content gracefully.
export function parseBlocks(content: string | null | undefined): WaiverBlock[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((b) => b && typeof b.text === 'string')
        .map((b) => ({ ...b, id: b.id || newBlockId() }));
    }
  } catch {
    // Not JSON — treat the whole thing as one paragraph (strip any tags).
    return [
      { id: newBlockId(), type: 'p', text: String(content).replace(/<[^>]+>/g, ' ').trim() },
    ];
  }
  return [];
}

export const PREMADE_WAIVER_TITLE =
  'Gym Membership Waiver, Release of Liability, and Access Agreement';

const h2 = (text: string): WaiverBlockSeed => ({ type: 'h2', text, align: 'center' });
const h3 = (text: string): WaiverBlockSeed => ({ type: 'h3', text });
const p = (text: string): WaiverBlockSeed => ({ type: 'p', text });
const li = (text: string): WaiverBlockSeed => ({ type: 'bullet', text });

const SEED: WaiverBlockSeed[] = [
  h2('Gym Membership Waiver, Release of Liability, and Access Agreement'),
  p('This Waiver, Release of Liability, and Access Agreement is entered into by the undersigned member, guest, visitor, participant, or user of the facility (“Participant”) in favor of [Gym Name], its owners, employees, contractors, agents, landlords, affiliates, successors, and assigns (“Gym”).'),
  p('By signing this Agreement, Participant acknowledges and agrees as follows:'),

  h3('1. Assumption of Risk'),
  p('Participant understands that using a gym, fitness facility, exercise equipment, weights, machines, cardio equipment, saunas, recovery areas, locker rooms, bathrooms, parking areas, classes, personal training services, and related facilities involves risk.'),
  p('These risks include, but are not limited to:'),
  li('muscle strains, sprains, tears, soreness, and fatigue'),
  li('broken bones, falls, slips, trips, or impacts'),
  li('dizziness, fainting, dehydration, overheating, or heart-related events'),
  li('injury from improper use of equipment'),
  li('injury caused by other members, guests, or third parties'),
  li('illness, infection, or exposure to communicable disease'),
  li('property damage, theft, or loss'),
  p('Participant voluntarily accepts and assumes all risks, known and unknown, related to entering the Gym, using the Gym, participating in any activity, or using any equipment or service.'),

  h3('2. Medical Fitness'),
  p('Participant represents that they are physically able to use the Gym and participate in exercise activities. Participant is responsible for consulting a physician before beginning any exercise program if they have any medical condition, injury, limitation, or concern.'),
  p('Participant agrees to stop exercising immediately if they experience chest pain, dizziness, shortness of breath, faintness, unusual pain, or any other concerning symptom.'),

  h3('3. Release of Liability'),
  p('To the fullest extent allowed by law, Participant releases and agrees not to sue the Gym for any injury, illness, death, loss, theft, damage, claim, cost, or expense arising out of or related to Participant’s use of the Gym, presence at the Gym, participation in activities, use of equipment, or use of any Gym service.'),
  p('This release applies whether the claim arises from ordinary negligence, premises conditions, equipment use, instruction, supervision, lack of supervision, actions of other members or guests, or any other risk associated with fitness activities, except where such release is prohibited by law.'),

  h3('4. Indemnification'),
  p('Participant agrees to defend, indemnify, and hold harmless the Gym from any claim, demand, lawsuit, damage, loss, liability, cost, or attorney’s fees arising out of:'),
  li('Participant’s use of the Gym'),
  li('Participant’s violation of Gym rules'),
  li('Participant’s conduct at or around the Gym'),
  li('injury or damage caused by Participant'),
  li('Participant allowing another person to enter the Gym without authorization'),

  h3('5. Unauthorized Access, Tailgating, and Letting Others In'),
  p('Participant understands that their membership, access code, app access, key fob, door credential, or entry method is personal to them only.'),
  p('Participant may not allow any other person to enter the Gym unless that person has been separately authorized by the Gym and has completed all required membership documents, waivers, payments, and access procedures.'),
  p('This includes, but is not limited to:'),
  li('opening the door for another person'),
  li('allowing someone to follow them inside'),
  li('sharing an access code, app login, key fob, barcode, card, or other credential'),
  li('bringing in a friend, family member, guest, trainer, client, or child without permission'),
  li('propping open doors or otherwise bypassing access control'),
  li('allowing entry during staffed or unstaffed hours without proper authorization'),
  p('Participant agrees that if they allow any unauthorized person into the Gym, Participant is financially and legally responsible for that person’s presence and conduct.'),
  p('This responsibility includes, but is not limited to:'),
  li('any membership fees, guest fees, day-pass fees, access fees, or penalties owed'),
  li('any damage caused by the unauthorized person'),
  li('any theft, loss, injury, or incident involving the unauthorized person'),
  li('any claim, lawsuit, medical expense, attorney’s fee, settlement, or judgment arising from the unauthorized person’s entry, injury, conduct, or use of the Gym'),
  p('Participant agrees to indemnify, defend, and hold harmless the Gym from any claim brought by or on behalf of any unauthorized person Participant allowed into the Gym.'),
  p('Participant understands that unauthorized access may result in immediate membership termination, loss of access privileges, additional fees, legal action, and/or referral to law enforcement where appropriate.'),

  h3('6. Guest Policy'),
  p('Guests are not allowed unless expressly permitted by the Gym.'),
  p('Any approved guest must complete the Gym’s required waiver and registration process before entering or using the facility. A member does not have authority to waive this requirement for a guest.'),
  p('Participant understands that they cannot sign a waiver on behalf of another adult unless legally authorized to do so.'),

  h3('7. Equipment Use and Safety Rules'),
  p('Participant agrees to use all equipment properly and safely. Participant is responsible for asking for instruction before using unfamiliar equipment.'),
  p('Participant agrees not to misuse equipment, drop weights improperly, alter equipment, disable safety features, use damaged equipment, or engage in reckless conduct.'),
  p('Participant agrees to follow all posted rules, staff instructions, safety notices, access rules, and membership policies.'),

  h3('8. No Guarantee of Supervision'),
  p('Participant understands that the Gym may be unstaffed or minimally staffed at certain times.'),
  p('Participant agrees that they are responsible for their own safety, judgment, exercise choices, equipment use, and decision to exercise without direct supervision.'),

  h3('9. Personal Property'),
  p('Participant is responsible for their own personal property. The Gym is not responsible for lost, stolen, or damaged property, including items left in lockers, vehicles, bathrooms, workout areas, or common areas.'),

  h3('10. Video Surveillance and Access Logs'),
  p('Participant understands that the Gym may use video surveillance, door access logs, check-in records, app logs, and other security systems for safety, security, rule enforcement, billing, and incident review.'),
  p('Participant consents to such monitoring while on or around Gym property.'),

  h3('11. Damages and Fees'),
  p('Participant agrees to pay for any damage they cause to the Gym, equipment, doors, locks, access systems, furniture, fixtures, bathrooms, locker rooms, or other property.'),
  p('Participant also agrees to pay any fees listed in the Gym’s membership agreement or posted policies, including unauthorized guest/access fees, replacement access credential fees, cleaning fees, chargeback fees, and damage-related costs.'),

  h3('12. Minor Participants'),
  p('If Participant is signing for a minor, the parent or legal guardian represents that they have authority to sign on the minor’s behalf.'),
  p('The parent or guardian accepts full responsibility for the minor’s safety, conduct, injuries, damages, and compliance with Gym rules.'),
  p('The parent or guardian agrees to indemnify and hold harmless the Gym from claims related to the minor’s use of the Gym, to the fullest extent allowed by law.'),

  h3('13. Acknowledgment'),
  p('Participant has read this Agreement, understands it, and signs it voluntarily.'),
  p('Participant understands that this Agreement includes a release of liability and an agreement to be financially and legally responsible for unauthorized persons they allow into the Gym.'),
  p('Participant understands that they are giving up certain legal rights by signing this Agreement.'),
];

export function premadeWaiverBlocks(): WaiverBlock[] {
  return withIds(SEED);
}

// Shown above the Initials field in the e-sign block on every waiver.
export const UNAUTHORIZED_ENTRY_NOTICE =
  'I understand that I may not let anyone into the Gym without authorization. ' +
  'If I do, I am financially and legally responsible for that person, including ' +
  'any injury, damage, theft, claim, lawsuit, attorney’s fees, settlement, ' +
  'or judgment related to that person’s entry or use of the Gym.';
