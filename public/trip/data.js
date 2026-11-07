// Epic or Fail: Vegas Trip: all the tunable content in one place (prices, perks, outfits, menus, wishes, lines, ranks).
// Play money only; every resort, show and brand here is a fictional parody.

export const START_MIN = 10 * 60;            // Day 1, 10:00 AM (minutes since Day 1 midnight)
export const END_MIN = 4 * 1440 + 12 * 60;   // Day 5, 12:00 PM checkout (v8.1: then make the 4 PM flight home)
export const WALLET0 = 1000, WALLET_BACK = 300; // v8.1: everyone lands with $1,000; a pickpocket takes the wallet right after check-in; recovering it returns what's left
export const AIRPORT_BY = 3 * 60, FLIGHT_AT = 4 * 60, EXTEND_COST = 150, EXTEND_MAX = 2; // be at the airport 3 h after checkout; extend the stay up to 2 nights
export const SPEEDS = [0.5, 1, 2];           // 1× = one real minute per game hour

export const TRIP_TYPES = {
  solo: { n: 'Solo Singles Trip', icon: '🕶️', d: 'Just you, the Strip and some questionable decisions.' },
  bday: { n: "Bestie's Birthday Blowout", icon: '🎂', d: "It's your bestie's big 3-0-something. Make it legendary." },
  bach: { n: 'Bachelor / Bachelorette Chaos', icon: '💍', d: 'Last fling before the ring. Shows, bottles, matching fits.' },
};

export const BACKSTORIES = {
  divorcee: { n: 'Newly Single Divorcee', icon: '💔', cash: 85, pocket: 'tucked in your blazer pocket', perk: 'Alimony Splurge', perkD: '+25% Fun and Vibe from cocktails, steak dinners and VIP bottle service.',
    story: 'You signed the divorce papers at 8 AM, threw the wedding ring into the airport fountain, and landed in Vegas ready for chaos. Then the airline lost your designer bags.' },
  dj: { n: 'Aspiring DJ', icon: '🎧', cash: 55, pocket: 'folded in your phone case', perk: 'Booth Plug', perkD: '+45% pay and a wider timing window on DJ Booth gigs, +50% Fun from dancing in the club.',
    story: 'You flew in hoping to open for DJ Tileo at the Mega Club. The budget airline sent your custom dubplate crate to Boise.' },
  influencer: { n: 'Clout-Chasing Influencer', icon: '🤳', cash: 65, pocket: 'in your ring-light pouch', perk: 'Do It For The Plot', perkD: '2× cash and Fun from Photo Gigs, +15 Style and Charm on every outfit.',
    story: 'You promised your followers a luxury high-roller weekend vlog. The airline promptly lost your ring-light suitcase.' },
  party: { n: 'Unstoppable Party Animal', icon: '🦁', cash: 50, pocket: 'stuffed in your neon fanny pack', perk: 'Iron Liver & Second Wind', perkD: 'Your Buzz sweet spot stretches to 78% and nighttime Energy drains 35% slower.',
    story: "You woke up riding baggage carousel 11 in yesterday's wrinkled plane clothes, with a fat wallet, $50 stuffed in a neon fanny pack and a prepaid suite voucher." },
};

// Besties: looks use the realistic faces from the people library; loves drive their Mood
export const BESTIES = {
  roxy: { n: 'Roxy', tag: 'The Party Tornado', icon: '🌪️', alt: 'ftank', look: { body: 'f', face: 'sportsf02', outfit: '#b0102a', style: 'solid', cut: 'tank', glasses: '' },
    loves: 'the Mega Club LED floor, roulette spins and late-night chaos', likes: ['dance', 'rl', 'marg', 'club'],
    lines: ['Club. Now. 💃', 'Spin the wheel! Red! RED!', 'Is it 2 AM yet? 😈', 'This song is MY song!'] },
  marcus: { n: 'Marcus', tag: 'The Chill Foodie & Card Shark', icon: '🥩', alt: 'malea16', look: { body: 'm', face: 'malea12', outfit: '#f2efe8', style: 'solid', cut: 'polo', beard: true, beardLevel: 35, glasses: '' },
    loves: 'Tomahawk steaks, blackjack, rooftop hot tubs and Sky Needle sunsets', likes: ['steak', 'bj', 'hotTub', 'needle'],
    lines: ['Steak o\'clock? 🥩', 'Feeling lucky at blackjack.', 'Hot tub. Rooftop. Sunset. Go.', 'Let\'s catch the sunset up the Needle.'] },
  tiff: { n: 'Tiff', tag: 'The VIP Glamour Queen', icon: '💅', alt: 'femalep02', look: { body: 'f', face: 'femalea12', outfit: '#e9b949', style: 'gold', glasses: 'aviator' },
    loves: 'Tiger Boutique shopping, VIP bottle service, stretch limos and Strip selfies', likes: ['boutique', 'vip', 'limo', 'selfie'],
    lines: ['Shopping. Tiger Boutique. Now. 🛍️', 'Bottle service or we riot.', 'Selfie by the fountains? 🤳', 'Call the limo, babe.'] },
  kev: { n: 'Kev', tag: 'The Chaos Gremlin', icon: '🌮', alt: 'malea17', look: { body: 'm', face: 'malea09', outfit: '#ff7a1a', style: 'solid', cut: 'tank', glasses: 'round' },
    loves: '2 AM street tacos, slot machines and hyping you up on shifts', likes: ['tacos', 'slots', 'job'],
    lines: ['Tacos? Tacos. 🌮', 'That slot is DUE, trust me.', 'Go get that bag! 💸', 'I licked a slot machine. Kidding. Mostly.'] },
};

// Outfits: map onto the game's look (style / cut / outfit colour). style = base Style score.
export const OUTFITS = {
  plane: { n: 'Wrinkled Economy Plane Clothes', price: 0, style: 10, tier: 'plane', look: b => ({ style: 'solid', cut: b === 'm' ? 'polo' : 'tee', outfit: '#8b8576' }) },
  flip: { n: 'Souvenir Flip-Flops & Tank', price: 20, style: 25, tier: 'casual', look: () => ({ style: 'solid', cut: 'tank', outfit: '#2fb5c9' }) },
  swim: { n: 'Resort Swimwear', price: 35, style: 35, tier: 'swim', look: () => ({ style: 'swim', outfit: '#1f6f8b' }) },
  squad: { n: 'Matching Vegas Squad Fit', price: 45, style: 50, tier: 'party', d: 'Comes as a two-pack: your bestie matches you.', look: b => ({ style: 'solid', cut: b === 'm' ? 'polo' : 'tee', outfit: '#e83e8c' }) },
  white: { n: 'Smart White Party Fit', price: 60, style: 60, tier: 'party', look: () => ({ style: 'white', outfit: '#ffffff' }) },
  tiger: { n: 'Signature Tiger-Print Statement Set', price: 110, style: 80, tier: 'party', statement: true, look: () => ({ style: 'tiger', outfit: '#ffffff' }) },
  gold: { n: '24K Gold Sequin High-Roller Fit', price: 180, style: 92, tier: 'party', statement: true, look: () => ({ style: 'gold', outfit: '#ffc94a' }) },
};
export const ACCESSORIES = {
  cap: { n: 'DJ Tileo VIP Snapback', price: 40, style: 8 },
  kicks: { n: 'Gold-Trim Deadstock Kicks', price: 75, style: 12 },
  chain: { n: 'Heavy Cuban Lion Chain', price: 95, style: 15 },
};

// Food & drink. fx: meter changes; fun / vibe are boosted by perks. hours > 0 jumps the clock.
export const ITEMS = {
  water: { n: 'Bottled Water', icon: '💧', price: 5, d: 'Hydration up, Buzz down, clears a hangover', fx: { hyd: 35, buzz: -15 }, cure: 'water' },
  tacos: { n: '2 AM Street Tacos', icon: '🌮', price: 9, d: 'Fast, cheap Hunger + Energy', fx: { hunger: 35, energy: 8 }, fun: 15 },
  burger: { n: 'Late-Night Smash Burger', icon: '🍔', price: 14, d: 'Solid Hunger + Energy', fx: { hunger: 50, energy: 12 }, fun: 20 },
  smoothie: { n: 'Rooftop Recovery Smoothie', icon: '🥤', price: 18, d: 'Big Hydration + Energy, instant hangover cure', fx: { hyd: 45, energy: 25 }, vibe: 5, cure: 'smoothie' },
  cocktail: { n: 'Signature Cocktail', icon: '🍸', price: 15, d: 'Buzz + Fun (costs Hydration)', fx: { buzz: 18, hyd: -8 }, fun: 25, vibe: 4, booze: true, splurge: true },
  marg: { n: '3-Foot Neon Margarita', icon: '🍹', price: 24, d: 'Big Buzz + Fun (costs Hydration)', fx: { buzz: 28, hyd: -12 }, fun: 45, vibe: 6, booze: true, splurge: true },
  steak: { n: 'Prime Tomahawk Steak Dinner', icon: '🥩', price: 45, d: '1.5 h · maxes Hunger, massive Vibe + Fun', fx: { hunger: 100, energy: 10 }, fun: 150, vibe: 25, hours: 1.5, splurge: true },
  // v8.1: more food (and a few more drinks) on every menu, plus room service, the Kingdom Café and airport snacks
  surfturf: { n: 'Surf & Turf (filet + lobster tail)', icon: '🦞', price: 65, d: '1.5 h · maxes Hunger, huge Vibe + Fun', fx: { hunger: 100, energy: 15 }, fun: 180, vibe: 28, hours: 1.5, splurge: true, as: 'steak', msg: "🦞 Surf & Turf at the Lion's Den: buttery lobster, perfect filet. Hunger maxed." },
  buffet: { n: 'Kingdom Buffet (all you can eat)', icon: '🍽️', price: 39, d: '1 h · crab legs, prime rib, dessert wall: maxes Hunger, Energy + Vibe', fx: { hunger: 100, energy: 18 }, fun: 80, vibe: 12, hours: 1, msg: '🍽️ The Kingdom Buffet: crab legs, prime rib, a chocolate fountain. You regret nothing.' },
  nachos: { n: 'Loaded Nachos', icon: '🧀', price: 12, d: 'Shareable Hunger + Fun', fx: { hunger: 38, energy: 6 }, fun: 18 },
  wings: { n: 'Buffalo Wings', icon: '🍗', price: 16, d: 'Saucy Hunger + Energy', fx: { hunger: 45, energy: 10, hyd: -4 }, fun: 22 },
  sliders: { n: 'Wagyu Sliders', icon: '🍔', price: 22, d: 'Big Hunger, a little Vibe', fx: { hunger: 55, energy: 12 }, fun: 30, vibe: 4, splurge: true },
  fries: { n: 'Truffle Fries', icon: '🍟', price: 9, d: 'Quick Hunger', fx: { hunger: 25 }, fun: 10 },
  pizza: { n: 'NY Pizza Slice', icon: '🍕', price: 7, d: 'Cheap, fast Hunger', fx: { hunger: 30, energy: 5 }, fun: 10 },
  hotdog: { n: 'Strip Hot Dog', icon: '🌭', price: 7, d: 'Street-cart classic', fx: { hunger: 28, energy: 4 }, fun: 8 },
  churros: { n: 'Churros & Chocolate', icon: '🥖', price: 9, d: 'Sweet Hunger + a little Vibe', fx: { hunger: 18, energy: 6 }, fun: 15, vibe: 4 },
  pretzel: { n: 'Giant Soft Pretzel', icon: '🥨', price: 8, d: 'Airport-sized snack', fx: { hunger: 28 }, fun: 8 },
  shrimp: { n: 'Jumbo Shrimp Cocktail', icon: '🍤', price: 19, d: 'Old-Vegas classic, Vibe up', fx: { hunger: 25, energy: 5 }, fun: 22, vibe: 5, splurge: true },
  salad: { n: 'Grilled Chicken Caesar', icon: '🥗', price: 15, d: 'Light Hunger + Energy, a little Hydration', fx: { hunger: 35, energy: 12, hyd: 6 }, fun: 10 },
  poke: { n: 'Ahi Poke Bowl', icon: '🐟', price: 18, d: 'Fresh: Hunger + Energy + Hydration', fx: { hunger: 45, energy: 14, hyd: 10 }, fun: 15 },
  sushi: { n: 'Sushi Platter', icon: '🍣', price: 34, d: 'Big Hunger, Vibe up', fx: { hunger: 55, energy: 12, hyd: 5 }, fun: 40, vibe: 8, splurge: true },
  lobster: { n: 'Lobster Mac & Cheese', icon: '🦞', price: 28, d: 'Rich comfort food', fx: { hunger: 60, energy: 10 }, fun: 35, vibe: 6, splurge: true },
  breakfast: { n: 'Big Vegas Breakfast', icon: '🍳', price: 19, d: 'Eggs, bacon, hash browns: big Hunger + Energy', fx: { hunger: 70, energy: 20 }, fun: 20 },
  pancakes: { n: 'Pancake Tower', icon: '🥞', price: 14, d: 'Syrup-soaked Hunger + Energy', fx: { hunger: 50, energy: 14 }, fun: 18, vibe: 3 },
  benny: { n: 'Eggs Benedict', icon: '🥚', price: 17, d: 'Brunch classic', fx: { hunger: 50, energy: 16 }, fun: 15 },
  bloody: { n: 'Bloody Mary', icon: '🍅', price: 14, d: 'Brunch Buzz + a little Hunger', fx: { buzz: 14, hunger: 8, hyd: -4 }, fun: 20, booze: true },
  coffee: { n: 'Iced Coffee', icon: '☕', price: 6, d: 'Energy boost', fx: { energy: 18, hyd: 4 }, fun: 4 },
  energy: { n: 'Energy Drink', icon: '⚡', price: 7, d: 'Big Energy jolt (costs Hydration)', fx: { energy: 26, hyd: -6 }, fun: 6 },
  lemonade: { n: 'Fresh Lemonade', icon: '🍋', price: 6, d: 'Hydration up', fx: { hyd: 30, buzz: -5 }, fun: 5 },
  mocktail: { n: 'Virgin Piña Colada', icon: '🍍', price: 9, d: 'Hydration + Vibe, zero Buzz', fx: { hyd: 22, buzz: -6 }, fun: 12, vibe: 3 },
  beer: { n: 'Ice-Cold Beer', icon: '🍺', price: 8, d: 'Easy Buzz + Fun', fx: { buzz: 12, hyd: -4 }, fun: 15, vibe: 2, booze: true },
  champ: { n: 'Glass of Champagne', icon: '🥂', price: 18, d: 'Classy Buzz + Vibe', fx: { buzz: 14, hyd: -5 }, fun: 30, vibe: 6, booze: true, splurge: true },
  msnack: { n: 'Minibar Snack Box', icon: '🍫', price: 15, d: 'Chocolate, nuts, regret', fx: { hunger: 22 }, fun: 6 },
  rsburger: { n: 'Room-Service Burger & Fries', icon: '🍔', price: 26, d: 'Under a silver dome', fx: { hunger: 60, energy: 14 }, fun: 25, vibe: 4 },
  rspizza: { n: 'Whole Pizza', icon: '🍕', price: 30, d: 'Share it, or don\'t', fx: { hunger: 70, energy: 12 }, fun: 30 },
  rsclub: { n: 'Club Sandwich', icon: '🥪', price: 21, d: 'The 3 AM classic', fx: { hunger: 50, energy: 10 }, fun: 15 },
  rsdessert: { n: 'Chocolate Lava Cake', icon: '🍰', price: 16, d: 'Vibe up', fx: { hunger: 20 }, fun: 20, vibe: 6 },
  mwater: { n: 'Minibar Water (it\'s Vegas)', icon: '💧', price: 9, d: 'Same water, worse price', fx: { hyd: 35, buzz: -15 }, cure: 'water', as: 'water' },
  mshot: { n: 'Minibar Mini-Bottles', icon: '🍾', price: 22, d: 'Buzz + Fun, suite prices', fx: { buzz: 18, hyd: -8 }, fun: 25, vibe: 4, booze: true, splurge: true, as: 'cocktail' },
};
// v8: the Booze Library stash (bought at the airport, poured from the suite bar cart for free)
export const STASH_FX = {
  bubbly: { fx: { buzz: 16, hyd: -6 }, fun: 45, vibe: 6, booze: true, msg: '🍾 Pop! Bubbly in the suite with the Strip glittering below.' },
  tequila: { fx: { buzz: 20, hyd: -8 }, fun: 35, vibe: 5, booze: true, msg: '🥃 Salt, shot, lime. A suite shot of silver tequila.' },
  seltzer: { fx: { buzz: 10, hyd: -2 }, fun: 20, vibe: 3, booze: true, msg: '🍺 Crack! An ice-cold hard seltzer from the bar cart.' },
  water: { fx: { hyd: 35, buzz: -15 }, cure: true, msg: '💧 Cold water from the bar cart.' },
};
export const VENUES = {
  lionbar: { n: 'Lion Lounge Bar', icon: '🦁', items: ['water', 'lemonade', 'beer', 'cocktail', 'champ', 'burger', 'sliders', 'wings', 'nachos', 'shrimp', 'fries'], gig: true },
  steak: { n: "Lion's Den Steakhouse", icon: '🥩', items: ['steak', 'surfturf', 'lobster', 'shrimp', 'salad', 'champ', 'water'] },
  'swim-up bar': { n: 'Swim-Up Bar', icon: '🏝️', items: ['water', 'lemonade', 'mocktail', 'beer', 'cocktail', 'marg', 'smoothie', 'poke', 'fries'], gig: true },
  'tiki bar': { n: 'Tiki Bar', icon: '🌺', items: ['water', 'mocktail', 'cocktail', 'marg', 'smoothie', 'burger', 'hotdog', 'nachos', 'poke'], gig: true },
  'Tiger Bar': { n: 'Tiger Bar · Mega Club', icon: '🐯', items: ['water', 'energy', 'beer', 'cocktail', 'marg', 'champ', 'sliders', 'fries'], gig: true },
  minibar: { n: 'Suite Minibar', icon: '🧊', items: ['mwater', 'mshot', 'msnack'] },
  cart: { n: 'Late-Night Taco & Water Cart', icon: '🌮', items: ['water', 'tacos', 'hotdog', 'churros', 'lemonade'] },
  cafe: { n: 'Kingdom Café · open 24/7', icon: '☕', items: ['coffee', 'breakfast', 'pancakes', 'benny', 'bloody', 'salad', 'pizza', 'churros', 'smoothie', 'buffet', 'water'] },
  roomservice: { n: 'Room Service · Suite 2407', icon: '🛎️', items: ['breakfast', 'pancakes', 'coffee', 'rsclub', 'rsburger', 'rspizza', 'sushi', 'lobster', 'rsdessert', 'champ', 'water'] },
  snacks: { n: 'Sin City Snacks (airport)', icon: '🥨', items: ['coffee', 'pretzel', 'pizza', 'energy', 'water'] },
};

// Wish lists: 5 per trip, by trip type (the 5th slot of friend trips is the bestie's own wish)
export const WISHES = {
  dance60: 'Dance 60 seconds on the Mega Club LED floor',
  bjWin: 'Win a hand of blackjack',
  steak: 'Eat a Prime Tomahawk Steak Dinner',
  sunset: 'Watch the sunset from the Sky Needle deck',
  photo4: 'Photo Gigs at 4 different Strip landmarks',
  shots: 'Birthday shots at the Tiger Bar (buy a round for two)',
  steak2: 'Birthday steak dinner for two',
  squad: 'Wear matching Vegas Squad Fits',
  limo: 'Cruise the Strip in the stretch limo',
  revue: 'See Thunder From the Kingdom',
  vip: 'VIP bottle service at the Mega Club',
  danceTogether: 'Dance 60 seconds on the LED floor together',
  roulette3: 'Spin the roulette wheel 3 times together',
  hotTub: 'Soak in a rooftop hot tub together',
  selfie2: 'Selfies at 2 different Strip landmarks',
  tacos2am: '2 AM street tacos (midnight to 4 AM)',
  crew3: 'Recruit a crew of 3 Vegas locals',
  buddyHour: 'Hang out with your trip buddy for an hour',
  suiteParty: 'Throw a suite party with your crew',
};
export const WISH_SETS = { solo: ['dance60', 'crew3', 'steak', 'sunset', 'photo4'], bday: ['shots', 'steak2', 'squad', 'limo'], bach: ['revue', 'vip', 'danceTogether', 'squad'] };
export const BESTIE_WISH = { roxy: 'roulette3', marcus: 'hotTub', tiff: 'selfie2', kev: 'tacos2am' };

// 2 AM wander-off spots
export const WANDER = {
  fountain: { area: 'lobby', x: 4.6, z: 5.4, ry: -2.4, mode: 'dance', where: 'the Gold Lion Fountain in the lobby' },
  roulette: { area: 'lobby', x: 43.6, z: 17.6, ry: 3.6, mode: 'wave', where: 'the roulette wheel in the casino' },
  grotto: { area: 'pool', x: 1.8, z: 36.2, ry: 3.1, mode: 'dance', where: 'the Grotto behind the pool waterfall' },
  fountains: { area: 'strip', x: -19.5, z: 213, ry: -1.57, mode: 'wave', where: 'the Bellissimo Fountains on the Strip' },
};
export const WANDER_TEXT = {
  fountain: ['the LION is SINGING to me 🦁✨ come seeeee', 'i made friends with a golden cat. he is wet. so am i'],
  roulette: ['i put my phone on red. jk. come watch the wheel spin 🎡', 'the wheel guy says i have "lucky elbows" ??'],
  grotto: ['im behind a waterfall. like a mermaid. or a burglar 🧜', 'found a secret cave by the pool!! bring snacks'],
  fountains: ['the fountains are dancing and so am i ⛲💃', 'at the big fountain show. a man in a pink jacket waved at me'],
};

export const BLACKOUTS = [
  'You remember a mariachi band, a wedding chapel brochure, and someone yelling "SHOTS FOR THE GOOSE."',
  'Flashes: a karaoke duet with a stranger named Gary, a foam finger, and a very confident limbo attempt.',
  'All you recall is a churro, a parking cone you named Kevin, and a standing ovation for reasons unknown.',
  'You wake up with a temporary tattoo that says "MOM" and absolutely no memory of the last four hours.',
];
export const WAKE_SPOTS = [
  { area: 'strip', x: 30, z: -324, yaw: Math.PI / 2, where: 'on a bench outside TILEO KINGDOM' },
  { area: 'pool', x: -33, z: -42, yaw: Math.PI, where: 'face-down on a pool lounger' },
  { area: 'lobby', x: -10, z: 14, yaw: Math.PI / 2, where: 'on the lobby sofa, wearing a stranger\'s visor' },
  { area: 'strip', x: -19, z: 206, yaw: -Math.PI / 2, where: 'by the Bellissimo Fountains, damp' },
];

export const BOUNCER = {
  plane: ['Bouncer: "Sir/ma\'am, that outfit has been on a plane. And a bus. And possibly a goat. No."', 'Bouncer: "Wrinkled economy chic? Not tonight. Tiger Boutique is in the lobby."'],
  casual: ['Bouncer: "Flip-flops? This is the Mega Club, not a hostel shower."', 'Bouncer: "Cute tank. Wrong building. Come back dressed for the party."'],
  swim: ['Bouncer: "Pool\'s on the roof, mermaid. Put some clothes on."', 'Bouncer: "We don\'t do swimwear past the velvet rope."'],
  stale: ['Bouncer: "I can smell that outfit from here. Shower, then come back."', 'Bouncer: "Your fit is giving \'day three, no laundry.\' Freshen up."'],
};
export const LIFEGUARD = ['Lifeguard: "Whoa! No street clothes in the pool, pal."', 'Lifeguard: "Jeans in the water? Not on my watch. Swimwear only."'];

export const RANKS = [
  { k: 'S', n: '👑 Legend of the Strip', d: 'Every wish, a happy bestie, cash to spare. They\'ll write songs about this trip.' },
  { k: 'L', n: '💘 Vegas Love Story', d: 'You came for a trip and found {who}. What happens in Vegas… might not stay in Vegas.' },
  { k: 'A+', n: '🎉 Bestie of the Century', d: 'Your bestie will be talking about this trip at your wedding. And theirs.' },
  { k: 'A', n: '💎 Vegas High Roller', d: 'You came with lint and left with a bankroll. Respect.' },
  { k: 'B', n: '🥂 Survived Sin City', d: 'Fed, watered, mostly dignified. A solid Vegas run.' },
  { k: 'C', n: '🤕 Barely Made the Flight', d: 'You made the flight. Barely. Your sunglasses are on upside down.' },
  { k: 'F', n: '🚌 Broke & Alone on the Greyhound Home', d: 'Zero dollars, one flip-flop, a 19-hour bus ride. Epic fail.' },
];

// Bartending Rush recipes (3 ingredients each, any order)
export const RECIPES = {
  "Tiger's Kiss": ['Vodka', 'Passion Fruit', 'Gold Glitter'],
  'Gold Mane Margarita': ['Tequila', 'Lime', 'Agave'],
  'Velvet Roar': ['Bourbon', 'Cherry', 'Bitters'],
  'Midnight Mojito': ['Rum', 'Mint', 'Lime'],
  'Jungle Spritz': ['Prosecco', 'Passion Fruit', 'Mint'],
};
export const INGREDIENTS = ['Vodka', 'Tequila', 'Rum', 'Bourbon', 'Prosecco', 'Lime', 'Mint', 'Passion Fruit', 'Agave', 'Cherry', 'Bitters', 'Gold Glitter'];

export const REVUE = [
  '🎤 "Ladies, gentlemen and everyone in between… THUNDER FROM THE KINGDOM!"',
  '🚒 The Kingdom Firefighters slide down a pole that is very clearly a mic stand.',
  '🕺 A perfectly synchronized tear-away… revealing a second, shinier tuxedo.',
  '🔥 PYRO! (It is a hair dryer and some gold streamers.)',
  '🌹 One of them throws a rose into the crowd. The whole row screams.',
  '👑 Standing ovation. Somebody\'s grandma is crying happy tears.',
];
