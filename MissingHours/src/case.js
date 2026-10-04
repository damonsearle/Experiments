export const evidence = [
  { id: 'plinth', place: 'flower', title: 'An empty plinth', kind: 'Scene examination', body: 'The moonflower was rooted in a ceramic tub. Its catalogue lists a combined weight of 48 kg. There is no loose soil or damage: the whole tub was moved. Fresh cart-wheel marks lead from the plinth to the service door.' },
  { id: 'door', place: 'flower', title: 'The service entrance', kind: 'Measured dimensions', body: 'The greenhouse was locked to visitors at 23:30. The service door automatically unlocked from 23:50 to midnight for deliveries, using a separate mechanical timer. Its opening is 1.4 m wide; the cart is 1.1 m wide. The windows are intact.' },
  { id: 'print', place: 'tracks', title: 'The giant footprint', kind: 'Track examination', body: 'The apparent 90 cm footprint has two heel centres and six toe impressions. Its edges cross over each other. Two ordinary three-toed, 45 cm tracks reproduce the shape when overlapped. Depth varies with the softness of the mud; it cannot establish body weight.' },
  { id: 'profiles', place: 'tracks', title: 'Track reference card', kind: 'Measured comparison', body: 'Bront: 90 cm feet, four toes, 2.1 m shoulder width. Mara and Orin: both 45 cm feet, three toes, under 1 m shoulder width. The tracks alone cannot distinguish Mara from Orin.' },
  { id: 'clock', place: 'clock', title: 'Eight missing minutes', kind: 'Maintenance strip', body: 'The controller clock matched city time at 23:30. It stopped during the outage from 23:40 to 23:48, then resumed without correcting itself. The cart scanner uses this same controller. The door timer and weighbridge run independently.' },
  { id: 'scan', place: 'clock', title: 'Service-door scan', kind: 'Controller record', body: 'Cart C-7 crossed out of the greenhouse at displayed time 23:48. The scanner records crossings, not the person pushing. The record occurred after the controller resumed; it was not queued during the outage.' },
  { id: 'weights', place: 'cart', title: 'The cart gained weight', kind: 'Independent weighbridge', body: 'Cart C-7: entry 23:51, gross weight 126 kg; exit 23:58, gross weight 174 kg. The calibrated bridge weighs the cart without its operator. Its inspection photo shows the original sealed cargo still aboard. The paperwork lists no collection or added cargo.' },
  { id: 'orin', place: 'cart', title: 'Orin’s delivery account', kind: 'Signed statement', body: '“I only dropped off supplies. Mara borrowed my cart after that. I waited outside.” Orin is a small three-toed courier assigned to C-7. He says he did not enter the greenhouse or carry anything out.' },
  { id: 'witness', place: 'gate', title: 'The gatekeeper’s notebook', kind: 'Independent observation', body: 'The gatekeeper watched the only courtyard gate from 23:30 until midnight. Only Mara, Bront and Orin were present. Mara left at 23:52 without the cart and did not return. Bront stayed at the gate, talking to the keeper. At 23:56, Orin alone pushed C-7 out of the greenhouse, carrying a covered tub. A freight train passed overhead at that moment.' },
  { id: 'mara', place: 'gate', title: 'Mara’s account', kind: 'Witness statement', body: '“The flower was on its plinth when I checked at 23:50. I left two minutes later. Orin was coming through the service door with his cart. Then I heard the freight train on my way home.” Mara is the gardener. Her departure agrees with the gatekeeper’s independently timed notes.' },
  { id: 'ledger', place: 'rail', title: 'A very quiet railway', kind: 'Municipal freight ledger', body: 'Official extract: no train movements between 23:50 and 00:10. Yet two witnesses recall a freight train in this interval. A small discrepancy. Unless the witnesses are right.' },
];

export const places = [
  { id: 'flower', label: 'Empty plinth', x: 0, z: -2, quote: '“A locked door is a statement. Let’s see if the evidence agrees.”' },
  { id: 'tracks', label: 'Muddy tracks', x: -3.6, z: 2, quote: '“An enormous footprint. Conveniently enormous.”' },
  { id: 'clock', label: 'Controller clock', x: -4.8, z: -3.1, quote: '“Even a stopped clock is right twice a day. This one prefers being eight minutes late.”' },
  { id: 'cart', label: 'Delivery cart', x: 4, z: 1.8, quote: '“Funny. Most deliveries make a cart lighter.”' },
  { id: 'gate', label: 'Gatekeeper', x: -1, z: 5.5, quote: '“Start with what you saw. We’ll get to what you think it means.”' },
  { id: 'rail', label: 'Freight ledger', x: 4.8, z: -4.2, quote: '“A city full of noise. A record full of silence.”' },
];

export const deductions = [
  { id: 'time', title: '01 / Reconstruct the crossing', question: 'When did C-7 actually leave the greenhouse?', options: ['23:40', '23:48', '23:56', '00:04'], answer: '23:56', requires: ['clock', 'scan'], hint: 'Read the maintenance strip and service-door scan together. After the outage, is the controller ahead of city time or behind it?', wrong: 'The controller stopped for eight minutes and resumed without catching up. Account for those missing minutes.', explanation: 'The controller was eight minutes slow. Its 23:48 crossing happened at 23:56 city time.' },
  { id: 'tracks', title: '02 / Read the mud', question: 'What does the giant footprint establish?', options: ['Bront entered the greenhouse', 'Orin made the tracks', 'Two smaller tracks overlap', 'A heavy dinosaur carried the tub'], answer: 'Two smaller tracks overlap', requires: ['print', 'profiles'], hint: 'Compare heel centres and toe counts. A footprint’s outside dimensions are only part of the evidence.', wrong: 'Bront has four toes. The mark has two heel centres and six toe impressions. Neither the depth nor the shape identifies Orin.', explanation: 'Two three-toed tracks overlap. They exclude Bront as their maker, but cannot distinguish Mara from Orin.' },
  { id: 'removal', title: '03 / Follow the missing weight', question: 'Which account fits the physical evidence and independent observations?', options: ['Mara left with the moonflower', 'Bront carried the tub through the service door', 'Orin wheeled out the moonflower in C-7', 'The flower was destroyed during the outage'], answer: 'Orin wheeled out the moonflower in C-7', requires: ['plinth', 'weights', 'witness'], hint: 'Compare the tub’s weight with the cart’s change in weight, then establish who was pushing it.', wrong: 'Follow the entire 48 kg tub. The cart’s original cargo remained aboard, and the gatekeeper identifies who pushed it out.', explanation: 'C-7 gained exactly the tub’s 48 kg while retaining its original cargo. The gatekeeper saw Orin push it out with a covered tub; Mara had left and Bront stayed at the gate.' },
];

export function assessDeduction(id, answer, selected, collected) {
  const deduction = deductions.find(item => item.id === id);
  if (!deduction) return { ok: false, message: 'Unknown deduction.' };
  const valid = selected.filter(item => collected.includes(item));
  if (selected.some(item => !collected.includes(item))) return { ok: false, message: 'Inspect each piece of evidence before citing it.' };
  if (!answer) return { ok: false, message: 'Choose a claim, then attach the evidence that supports it.' };
  if (answer !== deduction.answer) return { ok: false, message: deduction.wrong };
  if (!deduction.requires.every(item => valid.includes(item))) return { ok: false, message: 'That explanation is possible, but the attached evidence does not yet establish every part of it. Find and cite the missing link.' };
  if (valid.length !== deduction.requires.length) return { ok: false, message: 'Narrow your citations to the evidence needed to establish this claim. Leave out records that do not test it.' };
  return { ok: true, message: deduction.explanation };
}
