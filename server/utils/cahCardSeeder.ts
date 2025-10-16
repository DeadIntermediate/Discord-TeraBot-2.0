import { sql } from 'drizzle-orm';
import { db } from '../db';
import { cahWhiteCards, cahBlackCards } from '../../shared/schema';

// Official Cards Against Humanity Base Set White Cards
const BASE_WHITE_CARDS = [
  "A Big Black Man",
  "A Bleached Asshole",
  "A Bloody Pacifier",
  "A Crappy Little Hand",
  "A Defective Condom",
  "A Falcon With A Cap On",
  "A Fart",
  "A Gassy Antelope",
  "A Homoerotic Volleyball Montage",
  "A Hot Mess",
  "A Lifetime Of Sadness",
  "A Malnourished Child",
  "A Micropenis",
  "A Mime Having A Stroke",
  "A Nuanced Understanding Of Gender Politics",
  "A Salty Surprise",
  "A Snapping Turtle Biting The Tip Of Your Penis",
  "A Tribe Of Warrior Women",
  "A Windmill Full Of Corpses",
  "A Zesty Breakfast Burrito",
  "Advice From A Wise, Old Black Man",
  "Alcoholism",
  "An Asymmetric Boob Job",
  "An Endless Stream Of Diarrhea",
  "An Erection Lasting Longer Than Four Hours",
  "An Honest Cop With Nothing Left To Lose",
  "An Oversized Lollipop",
  "Andre The Giant's Enormous Fists",
  "Announcing That You Are About To Cum",
  "Another Shot Of Whiskey",
  "Ants",
  "Apologizing",
  "Arnold Schwarzenegger",
  "Authentic Mexican Cuisine",
  "Balls",
  "Batman",
  "Being A Busy Adult With Many Important Things To Do",
  "Being A Motherfucking Sorcerer",
  "Being Fabulous",
  "Being Fat And Stupid",
  "Being Rich",
  "Being The Only Gay Person In Your Apartment",
  "Bill Nye The Science Guy",
  "Bingeing And Purging",
  "Black People",
  "Boogers",
  "Bosnian Chicken Farmers",
  "Britney Spears At 55",
  "Bullshit",
  "Chainsaws For Hands",
  "Chafing",
  "Child Abuse",
  "Child Beauty Pageants",
  "Children On Leashes",
  "Civilians",
  "Coat Hanger Abortions",
  "Cockfights",
  "Consultants",
  "Crucifixion",
  "Crying Into A Hamburger",
  "Daddy Issues",
  "Dead Parents",
  "Dick Cheney",
  "Dick Fingers",
  "Doing The Right Thing",
  "Drinking Alone",
  "Dropping A Chandelier On Your Enemies And Riding The Rope Up",
  "Dry Heaving",
  "Dudes With Enormous Dicks",
  "Eating All Of The Cookies Before The Guests Arrive",
  "Eating Rockefeller's Asshole",
  "Elderly Japanese Men",
  "Emotions",
  "Estrogen",
  "Ethnic Cleansing",
  "Exactly What You'd Expect",
  "Explosive Decompression",
  "Famine",
  "Fancy Cheese",
  "Figgy Pudding",
  "Finding A Skeleton",
  "Firing A Rifle Into The Air While Balls Deep In A Squealing Hog",
  "Flying Sex Snakes",
  "Full Frontal Nudity",
  "Gandhi",
  "Genghis Khan",
  "German Dungeon Porn",
  "Getting Hilariously Gangbanged By The Blue Man Group",
  "Getting Naked And Watching Nickelodeon",
  "Getting Sassy",
  "Getting So Angry That You Pop A Boner",
  "Giving 110%",
  "Goats Eating Cans",
  "God",
  "Good Old-Fashioned Racism",
  "Grandma",
  "Half-Assed Foreplay",
  "Heartwarming Orphans",
  "Her Majesty, Queen Elizabeth II",
  "Heteronormativity",
  "Hipsters",
  "Historically Black Colleges",
  "Hope",
  "Hormone Injections",
  "Horse Meat",
  "Hot Cheese",
  "Hot Pockets",
  "Hurricane Katrina",
  "Immaculate Conception",
  "Inappropriate Yodeling",
  "Incest",
  "Jerking Off Into A Pool Of Children's Tears",
  "Justin Bieber",
  "Kids With Ass Cancer",
  "Lactation",
  "Licking Things To Claim Them As Your Own",
  "Literally Eating Shit",
  "Lunchables",
  "Lumberjack Fantasies",
  "Making A Pouty Face",
  "Making The Penises Kiss",
  "ManBearPig",
  "Masturbation",
  "Meat",
  "MechaHitler",
  "Men",
  "Menstruation",
  "Mexican Hats",
  "Micropenis",
  "Morgues",
  "My Genitals",
  "My Humps",
  "My Inner Demons",
  "My Relationship Status",
  "My Vagina",
  "Natural Male Enhancement",
  "Nazis",
  "Nickelback",
  "Not Giving A Shit About The Third World",
  "Old-People Smell",
  "One Ring To Rule Them All",
  "Oompa-Loompas",
  "Oversized Women's Sunglasses",
  "Owls",
  "Passable Transvestites",
  "Penis Envy",
  "Pixelated Bukkake",
  "Police Brutality",
  "Poor Life Choices",
  "Pooping Back And Forth. Forever.",
  "Powerful Thighs",
  "Praying The Gay Away",
  "Preteens",
  "Pterodactyl Eggs",
  "Pulling Out",
  "Queefing",
  "Racial Profiling",
  "Raptor Attacks",
  "Re-Gifting",
  "Robocop",
  "Ronald Reagan",
  "Scrotum Tickling",
  "Sculptures Of Perfectly Sculpted Ass",
  "Seeing Grandma Naked",
  "Seppuku",
  "Sexual Humiliation",
  "Sharing Needles",
  "Sitting On Santa's Lap",
  "Smegma",
  "Sniffing Glue",
  "Spectacular Abs",
  "Spontaneous Human Combustion",
  "Stranger Danger",
  "Sunshine And Rainbows",
  "Swooping",
  "Take-Backsies",
  "Taking Off Your Shirt",
  "Tangled Slinkies",
  "Testicular Torsion",
  "The American Dream",
  "The Big Bang",
  "The Blood Of Christ",
  "The Clitoris",
  "The Dance Of My People",
  "The Gays",
  "The Hardworking Mexican",
  "The Heart Of A Child",
  "The Holocaust",
  "The Inevitable Heat Death Of The Universe",
  "The Jews",
  "The KKK",
  "The Make-A-Wish Foundation",
  "The Miracle Of Child Birth",
  "The Patriarchy",
  "The Pope",
  "The Profoundly Handicapped",
  "The Trail Of Tears",
  "Third Base",
  "Throwing A Virgin Into A Volcano",
  "Tiny Nipples",
  "Trickle-Down Economics",
  "Two Midgets Shitting Into A Bucket",
  "Unfathomable Stupidity",
  "Vigorous Jazz Hands",
  "Waiting 'Til Marriage",
  "War Crimes",
  "Waterboarding",
  "White People",
  "Whipping It Out",
  "Women In Yogurt Commercials",
  "World Peace",
  "Yeast",
  "You Must Construct Additional Pylons"
];

// Official Cards Against Humanity Base Set Black Cards
const BASE_BLACK_CARDS = [
  { content: "I got 99 problems but __________ ain't one.", pickCount: 1 },
  { content: "Maybe she's born with it. Maybe it's __________.", pickCount: 1 },
  { content: "What's that smell?", pickCount: 1 },
  { content: "This is the way the world ends \\ This is the way the world ends \\ Not with a bang but with __________.", pickCount: 1 },
  { content: "What does Dick Cheney prefer?", pickCount: 1 },
  { content: "__________. That's how I want to die.", pickCount: 1 },
  { content: "What would grandma find disturbing, yet oddly charming?", pickCount: 1 },
  { content: "What's a girl's best friend?", pickCount: 1 },
  { content: "What's the next Happy Meal toy?", pickCount: 1 },
  { content: "__________. Betcha can't have just one!", pickCount: 1 },
  { content: "White people like __________.", pickCount: 1 },
  { content: "__________. High five, bro.", pickCount: 1 },
  { content: "After the earthquake, Sean Penn brought __________ to the people of Haiti.", pickCount: 1 },
  { content: "__________: good to the last drop.", pickCount: 1 },
  { content: "What's the most emo?", pickCount: 1 },
  { content: "Instead of coal, Santa now gives the bad children __________.", pickCount: 1 },
  { content: "What is Batman's guilty pleasure?", pickCount: 1 },
  { content: "TSA guidelines now prohibit __________ on airplanes.", pickCount: 1 },
  { content: "What ended my last relationship?", pickCount: 1 },
  { content: "MTV's new reality show features eight washed-up celebrities living with __________.", pickCount: 1 },
  { content: "I drink to forget __________.", pickCount: 1 },
  { content: "I'm sorry, Professor, but I couldn't complete my homework because of __________.", pickCount: 1 },
  { content: "Alternative medicine is now embracing the curative powers of __________.", pickCount: 1 },
  { content: "What's my secret power?", pickCount: 1 },
  { content: "What's the new fad diet?", pickCount: 1 },
  { content: "What am I giving up for Lent?", pickCount: 1 },
  { content: "What helps Obama unwind?", pickCount: 1 },
  { content: "What's there a ton of in heaven?", pickCount: 1 },
  { content: "What do old people smell like?", pickCount: 1 },
  { content: "Coming to Broadway this season, __________: The Musical.", pickCount: 1 },
  { content: "What's my anti-drug?", pickCount: 1 },
  { content: "What will always get you laid?", pickCount: 1 },
  { content: "The class field trip was completely ruined by __________.", pickCount: 1 },
  { content: "What will I bring back in time to convince people that I am a powerful wizard?", pickCount: 1 },
  { content: "While the United States raced the Soviet Union to the moon, the Mexican government funneled millions of pesos into research on __________.", pickCount: 1 },
  { content: "What did I bring back from Mexico?", pickCount: 1 },
  { content: "Anthropologists have recently discovered a primitive tribe that worships __________.", pickCount: 1 },
  { content: "What's Teach for America using to inspire inner city students to succeed?", pickCount: 1 },
  { content: "What did the US airdrop to the children of Afghanistan?", pickCount: 1 },
  { content: "What's my patronus?", pickCount: 1 },
  { content: "When I am a billionaire, I will erect a 50-foot statue to commemorate __________.", pickCount: 1 },
  { content: "What's the next superhero movie?", pickCount: 1 },
  { content: "In M. Night Shyamalan's new movie, Bruce Willis discovers that __________ had really been __________ all along.", pickCount: 2 },
  { content: "Make a haiku.", pickCount: 3 },
  { content: "__________ + __________ = __________.", pickCount: 3 },
  { content: "What's that sound?", pickCount: 1 },
  { content: "War! What is it good for?", pickCount: 1 },
  { content: "BILLY MAYS HERE FOR __________.", pickCount: 1 },
  { content: "__________ is a slippery slope that leads to __________.", pickCount: 2 },
  { content: "In a world ravaged by __________, our only solace is __________.", pickCount: 2 },
  { content: "What's the worst thing about being a kid?", pickCount: 1 },
  { content: "Studies show that lab rats navigate mazes 50% faster after being exposed to __________.", pickCount: 1 },
  { content: "What's the most pressing issue facing America today?", pickCount: 1 },
  { content: "What gives me uncontrollable gas?", pickCount: 1 },
  { content: "What would you find in Aladdin's cave?", pickCount: 1 },
  { content: "The make-a-wish foundation has now started granting dreams involving __________.", pickCount: 1 },
  { content: "Why can't I sleep at night?", pickCount: 1 },
  { content: "What's that weird smell?", pickCount: 1 },
  { content: "During sex, I like to think about __________.", pickCount: 1 },
  { content: "What did Vin Diesel eat for dinner?", pickCount: 1 },
  { content: "Next from J.K. Rowling: Harry Potter and the Chamber of __________.", pickCount: 1 },
  { content: "A romantic, candlelit dinner would be incomplete without __________.", pickCount: 1 },
  { content: "What's my kryptonite?", pickCount: 1 },
  { content: "When I'm in prison, I'll have __________ smuggled in.", pickCount: 1 },
  { content: "__________: kid-tested, mother-approved.", pickCount: 1 },
  { content: "What's the crustiest?", pickCount: 1 },
  { content: "Why am I sticky?", pickCount: 1 },
  { content: "What will haunt my dreams forever?", pickCount: 1 },
  { content: "Scientists have discovered that elements necessary for life: carbon, hydrogen, oxygen, nitrogen, and __________.", pickCount: 1 },
  { content: "And the Academy Award for __________ goes to __________.", pickCount: 2 },
  { content: "What's the gift that keeps on giving?", pickCount: 1 },
  { content: "Step 1: __________. Step 2: __________. Step 3: Profit.", pickCount: 2 },
  { content: "__________ would be woefully incomplete without __________.", pickCount: 2 },
  { content: "What's the foolproof way to cheer up a friend?", pickCount: 1 },
  { content: "Life for American Indians was forever changed when the White Man introduced them to __________.", pickCount: 1 },
  { content: "What don't you want to find in your Chinese food?", pickCount: 1 },
  { content: "__________. It's a trap!", pickCount: 1 },
  { content: "How am I maintaining my relationship status?", pickCount: 1 },
  { content: "What's my 1999 hit that was later covered by Glee?", pickCount: 1 },
  { content: "What did Jesus give up for the world?", pickCount: 1 },
  { content: "What's a problem that can be solved by throwing money at it?", pickCount: 1 },
  { content: "What am I thinking about right now?", pickCount: 1 },
  { content: "__________ is proof that God has abandoned us.", pickCount: 1 },
  { content: "What's the most controversial game at next year's Paralympics?", pickCount: 1 },
  { content: "What's the most satisfying thing to poop?", pickCount: 1 },
  { content: "When Pharaoh remained unmoved, Moses called down a Plague of __________.", pickCount: 1 },
  { content: "______ will be included in the next McLuhan.", pickCount: 1 },
  { content: "In the new Disney Channel Original Movie, Hannah Montana struggles with __________ for the first time.", pickCount: 1 },
  { content: "__________, baby, one more time.", pickCount: 1 },
  { content: "But before I kill you, Mr. Bond, I must show you __________.", pickCount: 1 },
  { content: "What's your defense mechanism?", pickCount: 1 },
  { content: "What's the highest thing you can do with friends?", pickCount: 1 },
  { content: "Who taught you the facts of life?", pickCount: 1 },
  { content: "What's love?", pickCount: 1 },
  { content: "What's the latest fad at your local nursing home?", pickCount: 1 },
  { content: "What's that new robot that everyone's talking about?", pickCount: 1 },
  { content: "What do you squint at?", pickCount: 1 },
  { content: "Coming this fall to CBS, __________ and __________ and roommates in an apartment in Brooklyn.", pickCount: 2 },
  { content: "What keeps me warm during cold, lonely nights?", pickCount: 1 },
  { content: "What's the worst way to go?", pickCount: 1 },
  { content: "What's a dead giveaway that I'm lying?", pickCount: 1 },
  { content: "What's the best way to troll people in an assisted living home?", pickCount: 1 },
  { content: "What never fails to liven up the party?", pickCount: 1 },
  { content: "__________: once you pop, the fun don't stop.", pickCount: 1 },
  { content: "What's fun until it gets weird?", pickCount: 1 },
  { content: "What are you bringing to the school bake sale?", pickCount: 1 },
  { content: "What's your favorite sexual position?", pickCount: 1 },
  { content: "Why am I broke?", pickCount: 1 },
  { content: "How do I feel about this relationship?", pickCount: 1 },
  { content: "What would be the worst \"buy one, get one free\" deal?", pickCount: 1 },
  { content: "What's the most inappropriate thing to do during a nursing home?", pickCount: 1 },
  { content: "What's a typical day like for Harry Potter?", pickCount: 1 },
  { content: "This morning my wife left me because of __________.", pickCount: 1 },
  { content: "What goes well with soup and a salad?", pickCount: 1 },
  { content: "What shouldn't you do at a bus stop?", pickCount: 1 },
  { content: "What's the latest diet fad?", pickCount: 1 },
  { content: "In the new Die Hard movie, Bruce Willis must save the world from __________.", pickCount: 1 },
  { content: "What's got two thumbs and __________? This guy!", pickCount: 1 },
  { content: "Before I take off your sock, we need to talk about __________.", pickCount: 1 },
  { content: "What's the latest craze in Silicon Valley?", pickCount: 1 },
  { content: "What's the latest fashion trend for hipsters?", pickCount: 1 },
  { content: "What's the new way to start a text message?", pickCount: 1 },
  { content: "What's the new emoji?", pickCount: 1 },
  { content: "What's the latest innovation in smartphone technology?", pickCount: 1 }
];

/**
 * Seed the database with official Cards Against Humanity cards
 */
export async function seedCahCards() {
  try {
    console.log('🃏 Starting Cards Against Humanity card seeding...');

    // Check if cards already exist
    const existingWhiteCards = await db.select().from(cahWhiteCards).limit(1);
    const existingBlackCards = await db.select().from(cahBlackCards).limit(1);

    if (existingWhiteCards.length > 0 || existingBlackCards.length > 0) {
      console.log('⚠️ Cards already exist in database. Skipping seeding.');
      return;
    }

    // Insert white cards
    console.log(`📝 Inserting ${BASE_WHITE_CARDS.length} white cards...`);
    const whiteCardInserts = BASE_WHITE_CARDS.map(content => ({
      content,
      cardSet: 'base',
      isApproved: true,
      isActive: true,
    }));

    await db.insert(cahWhiteCards).values(whiteCardInserts);

    // Insert black cards
    console.log(`📝 Inserting ${BASE_BLACK_CARDS.length} black cards...`);
    const blackCardInserts = BASE_BLACK_CARDS.map(card => ({
      content: card.content,
      pickCount: card.pickCount,
      cardSet: 'base',
      isApproved: true,
      isActive: true,
    }));

    await db.insert(cahBlackCards).values(blackCardInserts);

    console.log('✅ Cards Against Humanity card seeding completed successfully!');
    console.log(`📊 Summary: ${BASE_WHITE_CARDS.length} white cards, ${BASE_BLACK_CARDS.length} black cards`);

  } catch (error) {
    console.error('❌ Error seeding CAH cards:', error);
    throw error;
  }
}

/**
 * Add additional card sets (expansions, custom, etc.)
 */
export async function seedAdditionalCards() {
  try {
    console.log('🎮 Adding additional card sets...');

    // Family-friendly white cards for servers with strict content policies
    const FAMILY_FRIENDLY_WHITE_CARDS = [
      "Accidentally eating dog food",
      "A awkward hug",
      "A bad haircut",
      "A broken elevator",
      "A bunch of frogs",
      "A dance party",
      "A happy ending",
      "A herd of cats",
      "A jumping spider",
      "A misunderstood cow",
      "A really good book",
      "A singing telegram",
      "A successful diet",
      "A talking dog",
      "A very long story",
      "Being really, really, really good looking",
      "Breakfast for dinner",
      "Candy for breakfast",
      "Dancing like nobody's watching",
      "Doing the dishes",
      "Extra credit",
      "Finding money in your pocket",
      "Friendship",
      "Getting a high-five",
      "Getting lost in IKEA",
      "Happy tears",
      "Ice cream for breakfast",
      "Jumping in puddles",
      "Karaoke night",
      "Laughing until you cry",
      "Making new friends",
      "Pizza",
      "Playing video games all day",
      "Puppies",
      "Really good pizza",
      "Singing in the shower",
      "Staying in bed all day",
      "The perfect nap",
      "The smell of fresh cookies",
      "Wearing pajamas all day",
      "Winning at board games"
    ];

    // Gaming-themed white cards
    const GAMING_WHITE_CARDS = [
      "Lag",
      "Getting pwned by a 12-year-old",
      "Rage quitting",
      "Camping",
      "Speedrunning",
      "Achievement hunting",
      "Button mashing",
      "Getting banned from a Discord server",
      "Microtransactions",
      "DLC that should have been in the base game",
      "Day-one patches",
      "Early access that never leaves early access",
      "Farming for rare drops",
      "Getting team-killed",
      "Toxic teammates",
      "Stream sniping",
      "Backseating",
      "Getting your main nerfed",
      "Pay-to-win mechanics",
      "Loot boxes",
      "The final boss being disappointingly easy",
      "Tutorial levels that never end",
      "Escort missions",
      "Water levels",
      "Ice levels",
      "Fighting game inputs",
      "Motion controls",
      "Always-online requirements",
      "Region locking",
      "Console wars"
    ];

    // Mature/Adult-themed white cards (18+ content)
    const MATURE_WHITE_CARDS = [
      "A disappointing one-night stand",
      "Adult diapers",
      "A questionable fetish",
      "Angry sex",
      "Being drunk and horny",
      "Bondage gear",
      "Casual sex",
      "Daddy issues",
      "Dirty talk",
      "Exhibitionism",
      "Friends with benefits",
      "Getting handsy",
      "Having the talk",
      "Inappropriate workplace relationships",
      "Kinky roleplay",
      "Losing your virginity",
      "Making out in public",
      "Naughty photos",
      "One too many drinks",
      "Pole dancing",
      "Questionable browser history",
      "Role reversal",
      "Safe words",
      "Tinder hookups",
      "Uncomfortable silences after sex",
      "Vanilla sex",
      "Walk of shame",
      "X-rated dreams",
      "Your ex texting at 2 AM",
      "Zero foreplay"
    ];

    // Insert family-friendly cards
    const familyWhiteInserts = FAMILY_FRIENDLY_WHITE_CARDS.map(content => ({
      content,
      cardSet: 'family',
      isApproved: true,
      isActive: true,
    }));

    await db.insert(cahWhiteCards).values(familyWhiteInserts);

    // Insert gaming cards
    const gamingWhiteInserts = GAMING_WHITE_CARDS.map(content => ({
      content,
      cardSet: 'gaming',
      isApproved: true,
      isActive: true,
    }));

    await db.insert(cahWhiteCards).values(gamingWhiteInserts);

    // Insert mature cards
    const matureWhiteInserts = MATURE_WHITE_CARDS.map(content => ({
      content,
      cardSet: 'mature',
      isApproved: true,
      isActive: true,
    }));

    await db.insert(cahWhiteCards).values(matureWhiteInserts);

    // Additional black cards for different themes
    const ADDITIONAL_BLACK_CARDS = [
      { content: "The real reason I can't sleep at night is __________.", pickCount: 1 },
      { content: "My favorite Discord emoji is __________.", pickCount: 1 },
      { content: "The best part of this Discord server is __________.", pickCount: 1 },
      { content: "When I grow up, I want to be __________.", pickCount: 1 },
      { content: "The secret to happiness is __________.", pickCount: 1 },
      { content: "If I had a superpower, it would be __________.", pickCount: 1 },
      { content: "The worst part about Monday morning is __________.", pickCount: 1 },
      { content: "My biggest fear is __________.", pickCount: 1 },
      { content: "I wish I could forget about __________.", pickCount: 1 },
      { content: "The best way to make friends is through __________.", pickCount: 1 },
      { content: "My guilty pleasure is __________.", pickCount: 1 },
      { content: "If I could time travel, I would go back and change __________.", pickCount: 1 },
      { content: "The key to a successful relationship is __________.", pickCount: 1 },
      { content: "My biggest accomplishment this year was __________.", pickCount: 1 },
      { content: "The worst advice I ever received was '__________'.", pickCount: 1 }
    ];

    const additionalBlackInserts = ADDITIONAL_BLACK_CARDS.map(card => ({
      content: card.content,
      pickCount: card.pickCount,
      cardSet: 'community',
      isApproved: true,
      isActive: true,
    }));

    await db.insert(cahBlackCards).values(additionalBlackInserts);

    // Mature/Adult black cards (18+ content)
    const MATURE_BLACK_CARDS = [
      { content: "After a few drinks, I always end up __________.", pickCount: 1 },
      { content: "The most embarrassing thing in my browser history is __________.", pickCount: 1 },
      { content: "What I'm really thinking about during sex is __________.", pickCount: 1 },
      { content: "My dating profile says I enjoy __________, but really I just want __________.", pickCount: 2 },
      { content: "The morning after regret: __________.", pickCount: 1 },
      { content: "What ruined the mood last night? __________.", pickCount: 1 },
      { content: "I told my therapist about __________ and even they were shocked.", pickCount: 1 },
      { content: "The real reason my last relationship ended was __________.", pickCount: 1 },
      { content: "What's guaranteed to kill the mood? __________.", pickCount: 1 },
      { content: "My safe word is __________.", pickCount: 1 },
      { content: "What made me question my life choices? __________.", pickCount: 1 },
      { content: "I'm not drunk, I'm just __________.", pickCount: 1 },
      { content: "What do I do when my parents aren't home? __________.", pickCount: 1 },
      { content: "The most awkward thing to happen during a hookup is __________.", pickCount: 1 },
      { content: "What's my secret turn-on? __________.", pickCount: 1 }
    ];

    const matureBlackInserts = MATURE_BLACK_CARDS.map(card => ({
      content: card.content,
      pickCount: card.pickCount,
      cardSet: 'mature',
      isApproved: true,
      isActive: true,
    }));

    await db.insert(cahBlackCards).values(matureBlackInserts);

    console.log('✅ Additional card sets added successfully!');
    console.log(`📊 Added: ${FAMILY_FRIENDLY_WHITE_CARDS.length + GAMING_WHITE_CARDS.length + MATURE_WHITE_CARDS.length} white cards, ${ADDITIONAL_BLACK_CARDS.length + MATURE_BLACK_CARDS.length} black cards`);

  } catch (error) {
    console.error('❌ Error adding additional cards:', error);
    throw error;
  }
}

/**
 * Get card statistics
 */
export async function getCardStats() {
  try {
    const whiteCardCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(cahWhiteCards)
      .where(sql`is_active = true`);

    const blackCardCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(cahBlackCards)
      .where(sql`is_active = true`);

    const cardSetStats = await db
      .select({ 
        cardSet: cahWhiteCards.cardSet, 
        count: sql<number>`count(*)` 
      })
      .from(cahWhiteCards)
      .where(sql`is_active = true`)
      .groupBy(cahWhiteCards.cardSet);

    return {
      totalWhiteCards: whiteCardCount[0]?.count || 0,
      totalBlackCards: blackCardCount[0]?.count || 0,
      cardSetBreakdown: cardSetStats,
    };
  } catch (error) {
    console.error('Error getting card stats:', error);
    return {
      totalWhiteCards: 0,
      totalBlackCards: 0,
      cardSetBreakdown: [],
    };
  }
}