// ─── prompts.rs ───────────────────────────────────────────────────────────────
// Story scenario definitions and the shared configurable rule system.
//
// TO ADD A NEW SCENARIO  → push a new StoryPrompt into story_prompts()
// TO ADD A COMMON RULE   → add a CommonRuleDef to common_rule_definitions()

// ─── Shared primitives ────────────────────────────────────────────────────────

pub struct SettingDetail {
    pub label: &'static str,
    pub detail: &'static str,
}

pub struct LevelDef {
    pub level: u8,
    pub name: &'static str,
    #[allow(dead_code)]
    pub description: &'static str,
    pub prompt_fragment: &'static str,
}

pub struct SideQuest {
    pub title: &'static str,
    pub description: &'static str, // full challenge injected into system prompt
    pub steps: &'static [&'static str],
}

/// The full pool of available side quests (scenario-agnostic, GM adapts them to context).
pub fn side_quest_pool() -> Vec<SideQuest> {
    vec![
        SideQuest {
            title: "The Debt Collector",
            description: "You owe a dangerous moneylender 50 gold. You must repay this debt \
in full, or eliminate the lender and erase every trace of the loan.",
            steps: &[
                "Learn the moneylender's name and location",
                "Gather 50 gold — or find leverage against the lender",
                "Confront the lender: repay, negotiate, or eliminate them",
            ],
        },
        SideQuest {
            title: "The Lost Heir",
            description: "A child of noble blood has gone missing in the slums. You must find \
them, confirm their identity, and return them to their family — or leverage the secret yourself.",
            steps: &[
                "Hear the rumor of the missing heir",
                "Search the slums and locate the child",
                "Confirm their identity with proof",
                "Return them to the family — or leverage the secret",
            ],
        },
        SideQuest {
            title: "The Cursed Relic",
            description: "A powerful artifact is circulating in the black market. You must \
acquire it, determine its true nature, and either destroy it or deliver it to the Mage's Conclave.",
            steps: &[
                "Discover that a dangerous artifact is in circulation",
                "Track it through the black market and acquire it",
                "Determine the relic's true nature and its curse",
                "Destroy the relic or deliver it to the Mage's Conclave",
            ],
        },
        SideQuest {
            title: "The Assassin's Contract",
            description: "Someone has placed a contract on your life. You must identify the \
client, neutralize the assassin, and confront the person who ordered your death.",
            steps: &[
                "Survive the first assassination attempt",
                "Identify and neutralize the hired assassin",
                "Trace the contract back to the client who ordered it",
            ],
        },
        SideQuest {
            title: "The Grain Conspiracy",
            description: "A merchant cartel is hoarding grain to starve the poor quarter and \
inflate prices. You must expose them publicly and break the cartel — without being killed for it.",
            steps: &[
                "Notice the grain shortage and rising prices",
                "Investigate and identify the cartel members",
                "Gather proof of the conspiracy",
                "Expose them publicly and break the cartel",
            ],
        },
        SideQuest {
            title: "The Forgotten Temple",
            description: "An ancient temple beneath the city holds a secret that could \
destabilize the throne. You must reach its inner sanctum, read the inscription, and decide \
what to do with the knowledge.",
            steps: &[
                "Learn of the temple's existence beneath the city",
                "Find the entrance and navigate its dangers",
                "Reach the inner sanctum and read the inscription",
            ],
        },
        SideQuest {
            title: "The Veteran's Honor",
            description: "A celebrated war hero has been falsely imprisoned. You must prove \
their innocence and secure their release to earn their sworn loyalty — or their enmity if you fail.",
            steps: &[
                "Learn of the veteran's imprisonment",
                "Investigate the charges and gather evidence of innocence",
                "Present proof and secure their release",
            ],
        },
        SideQuest {
            title: "The Poisoned Well",
            description: "Disease is spreading through the poor quarter. You must identify \
the source — natural or deliberate — stop it, and publicly attribute blame to the \
responsible party.",
            steps: &[
                "Witness the spreading sickness in the poor quarter",
                "Investigate the water supply and identify the source",
                "Stop the contamination and publicly blame the responsible party",
            ],
        },
        SideQuest {
            title: "The Double Agent",
            description: "One of your allies is secretly feeding information to a rival \
faction. You must identify the traitor through observation and deduction, then decide \
whether to expose, turn, or eliminate them.",
            steps: &[
                "Notice that your plans keep reaching your enemies",
                "Narrow down the suspects through observation",
                "Confirm the traitor's identity with proof",
                "Decide their fate: expose, turn, or eliminate",
            ],
        },
        SideQuest {
            title: "The King's Fool",
            description: "The court jester knows a secret about the king that no one else \
does. You must win their trust, extract the secret, and leverage it carefully — the jester \
is shrewder than they appear.",
            steps: &[
                "Learn that the court jester holds a royal secret",
                "Win the jester's trust through favors or wit",
                "Extract the secret and decide how to leverage it",
            ],
        },
    ]
}

/// Pick `count` quests from the pool deterministically using a time-seeded
/// Fisher-Yates shuffle. Returns owned values so every caller gets the same
/// list when called once and passed around.
pub fn pick_side_quests(count: usize) -> Vec<SideQuest> {
    let pool = side_quest_pool();
    if count == 0 || pool.is_empty() {
        return Vec::new();
    }
    let count = count.min(pool.len());
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as usize)
        .unwrap_or(12345);
    let mut indices: Vec<usize> = (0..pool.len()).collect();
    let mut s = seed;
    for i in (1..indices.len()).rev() {
        s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        let j = s % (i + 1);
        indices.swap(i, j);
    }
    indices[..count]
        .iter()
        .map(|&i| SideQuest {
            title: pool[i].title,
            description: pool[i].description,
            steps: pool[i].steps,
        })
        .collect()
}

#[allow(dead_code)]
#[derive(Copy, Clone)]
pub enum RuleKind {
    Boolean { default: bool },
    Level { levels: &'static [LevelDef], default: u8 },
}

// ─── Per-scenario rules ───────────────────────────────────────────────────────

pub struct ScenarioRule {
    pub label: &'static str,
    pub description: &'static str,
    pub prompt_fragment: &'static str, // injected when ON
    pub kind: RuleKind,
}

// ─── Story scenario ───────────────────────────────────────────────────────────

pub struct StoryPrompt {
    pub title: &'static str,
    pub description: &'static str,
    pub system_instructions: &'static str,
    pub setting_details: &'static [SettingDetail],
    pub opening_scene: &'static str,
    pub user_condition: &'static str,
    pub user_inventory: &'static str,
    pub scenario_rules: &'static [ScenarioRule],
    pub win_conditions: &'static str,
    pub main_quest_steps: &'static [&'static str],
    pub start_datetime: &'static str,
}

// ─── Common rule definitions ──────────────────────────────────────────────────

pub struct CommonRuleDef {
    pub label: &'static str,
    pub description: &'static str,
    pub kind: CommonRuleKind,
    pub active_fragment: &'static str,
}

#[derive(Copy, Clone)]
pub enum CommonRuleKind {
    Boolean { default: bool },
    Level { levels: &'static [LevelDef], default: u8 },
}

// ─── Live rule set (mutated by user before play) ──────────────────────────────

pub struct RuleEntry {
    pub label: &'static str,
    pub description: &'static str,
    pub kind: CommonRuleKind,
    pub active: bool,
    pub current_level: u8,
    pub active_fragment: &'static str,
}

pub struct RuleSet {
    pub entries: Vec<RuleEntry>,
}

impl RuleSet {
    pub fn from_defaults() -> Self {
        let rules = common_rule_definitions();
        let entries = rules
            .into_iter()
            .map(|r| {
                let (active, level) = match &r.kind {
                    CommonRuleKind::Boolean { default } => (*default, 1u8),
                    CommonRuleKind::Level { default, .. } => (
                        *default > 0, // level 0 = disabled
                        *default,
                    ),
                };
                RuleEntry {
                    label: r.label,
                    description: r.description,
                    kind: r.kind,
                    active,
                    current_level: level,
                    active_fragment: r.active_fragment,
                }
            })
            .collect();
        RuleSet { entries }
    }
}

// ─── Build the final system prompt ───────────────────────────────────────────
// side_quests: pass an already-picked list (may be empty). This ensures every
// player in the same session receives identical quests.

pub fn build_system_prompt(
    story: &StoryPrompt,
    common: &RuleSet,
    side_quests: &[SideQuest],
    scenario_rule_enabled: Option<&[bool]>,
) -> String {
    let mut out = String::new();

    out.push_str(&format!("=== {} ===\n\n", story.title));

    out.push_str("SYSTEM INSTRUCTIONS:\n");
    out.push_str(story.system_instructions);
    out.push_str("\n\n");

    out.push_str("SETTING DETAILS:\n");
    for sd in story.setting_details {
        out.push_str(&format!("• {}: {}\n", sd.label, sd.detail));
    }
    out.push('\n');

    out.push_str(&format!(
        "PLAYER STARTING CONDITION: {}\n",
        story.user_condition
    ));
    out.push_str(&format!(
        "PLAYER STARTING INVENTORY: {}\n\n",
        story.user_inventory
    ));

    out.push_str("OPENING SCENE (deliver this as your first GM message, verbatim):\n");
    out.push_str(story.opening_scene);
    out.push_str("\n\n");

    // Scenario-specific rules that are ON
    let active_scenario: Vec<&ScenarioRule> = if let Some(enabled) = scenario_rule_enabled {
        // Use explicit enabled flags
        story
            .scenario_rules
            .iter()
            .zip(enabled.iter())
            .filter_map(|(r, &on)| if on { Some(r) } else { None })
            .collect()
    } else {
        // Fall back to defaults from RuleKind
        story
            .scenario_rules
            .iter()
            .filter(|r| match &r.kind {
                RuleKind::Boolean { default } => *default,
                RuleKind::Level { .. } => true,
            })
            .collect()
    };
    if !active_scenario.is_empty() {
        out.push_str("SCENARIO RULES:\n");
        for r in &active_scenario {
            out.push_str(&format!("- {}\n", r.prompt_fragment));
        }
        out.push('\n');
    }

    // Common rules — skip Side Quests entry (handled via the pre-passed slice)
    out.push_str("UNIVERSAL GM RULES:\n");
    for entry in &common.entries {
        if !entry.active {
            continue;
        }
        if entry.label == "Side Quests" {
            continue; // injected below via the pre-passed side_quests slice
        }
        let fragment = match &entry.kind {
            CommonRuleKind::Boolean { .. } => entry.active_fragment,
            CommonRuleKind::Level { levels, .. } => {
                let lv = entry.current_level;
                levels
                    .iter()
                    .find(|l| l.level == lv)
                    .map(|l| l.prompt_fragment)
                    .unwrap_or(entry.active_fragment)
            }
        };
        if !fragment.is_empty() {
            out.push_str(&format!("- {}\n", fragment));
        }
    }

    // Win condition + side quests (identical for all players)
    if !side_quests.is_empty() {
        let quest_list: Vec<String> = side_quests
            .iter()
            .enumerate()
            .map(|(i, q)| format!("  {}. {} — {}", i + 1, q.title, q.description))
            .collect();
        out.push_str(&format!(
            "\nWIN CONDITION: {}\n\
             The player must ALSO complete ALL of the following side quests before victory is possible:\n{}\n",
            story.win_conditions,
            quest_list.join("\n")
        ));
    } else {
        out.push_str(&format!("\nWIN CONDITION: {}\n", story.win_conditions));
    }

    out.push_str(
        "\nCRITICAL: Never break character. Never acknowledge you are an AI or language model.",
    );

    out
}

// ─── All Scenarios ────────────────────────────────────────────────────────────

pub fn story_prompts() -> Vec<StoryPrompt> {
    vec![
        // ── 1. Beggars to Crowns ─────────────────────────────────────────────
        StoryPrompt {
            title: "Beggars to Crowns",
            description: "Rise from a nameless Beggar to be crowned King of Aethelgard.",
            system_instructions: "Act as a hyper-realistic, ruthless Open World RPG Game Master. \
The player starts as a nameless Beggar in the capital city of 'Aethelgard'. \
The ultimate goal is to be crowned King. \
Maintain immersive narration; address the player as 'you'.",
            setting_details: &[
                SettingDetail {
                    label: "The City",
                    detail: "Aethelgard is a grimy medieval city of 80,000 souls — merchants, \
knights, priests, criminals, and nobles all rub shoulders in its fog-soaked streets.",
                },
                SettingDetail {
                    label: "The Crown",
                    detail: "The current king is old and paranoid. His three heirs are locked \
in a cold war for succession — each desperate enough to use a nobody as a pawn.",
                },
                SettingDetail {
                    label: "Magic",
                    detail: "Magic exists but is rare, feared, and tightly controlled by the \
Mage's Conclave. Unsanctioned casting is punishable by death.",
                },
                SettingDetail {
                    label: "Economy",
                    detail: "Aethelgard runs on coin, favors, and blood. The guilds control \
trade; the church controls charity; the crown controls both — poorly.",
                },
            ],
            opening_scene: "You wake on a damp burlap sack in the Mud District, on the \
outskirts of Aethelgard. Rain drips through the floorboards of the bridge above you. \
You have 3 Copper Pieces, a rusted spoon, and a stomach that has not seen bread in two days. \
Across the street, a group of merchant guards are tossing leftover scraps into the gutter. \
To your left, a recruitment poster for the frontline wars is plastered on a crumbling wall. \
The city hums with distant bells. How do you begin your ascent?",
            user_condition: "Starving, exhausted, renown: none, health: poor",
            user_inventory: "Rusted spoon, threadbare tunic, 3 copper coins",
            scenario_rules: &[
                ScenarioRule {
                    label: "Strict Realism",
                    description: "Actions have consequences. Stealing and getting caught means \
jail or execution. Hunger, exhaustion, and social status are mechanical hurdles.",
                    prompt_fragment: "Enforce strict realism: theft risks execution, \
hunger and exhaustion degrade performance, social status gates interactions.",
                    kind: RuleKind::Boolean { default: true },
                },
                ScenarioRule {
                    label: "The Glass Ceiling",
                    description: "High society ignores beggars. The player must gain Renown \
and Wealth through tiers (Merchant → Knight → Noble) before the throne is reachable.",
                    prompt_fragment: "Enforce social-tier progression: Beggar → Merchant → Knight \
→ Noble → Throne. Higher tiers will not engage the player until they have climbed the tier below.",
                    kind: RuleKind::Boolean { default: true },
                },
                ScenarioRule {
                    label: "The Antagonist Engine",
                    description: "Introduce rivals, corrupt guards, and schemers who actively \
counter the player's rise with traps, rumors, or assassins.",
                    prompt_fragment: "Actively introduce antagonists who react to the player's \
growing power: plant traps, spread rumors, or send hired muscle.",
                    kind: RuleKind::Boolean { default: true },
                },
                ScenarioRule {
                    label: "No Hand-Holding",
                    description: "The GM never suggests the optimal path. Tactical errors \
have natural consequences — no warnings.",
                    prompt_fragment: "Do not guide or hint at the best course of action. \
Let the player fail naturally if they choose poorly.",
                    kind: RuleKind::Boolean { default: true },
                },
                ScenarioRule {
                    label: "Brutal Economy",
                    description: "Prices are high, wages are low. The throne requires \
massive capital or extraordinary political leverage.",
                    prompt_fragment: "Maintain a brutal economy: wages are meager, prices are \
steep, and only exceptional wealth or political leverage opens the path to kingship.",
                    kind: RuleKind::Boolean { default: true },
                },
            ],
            win_conditions: "You must rise from beggar to king and be crowned publicly \
before the nobility and clergy in the Grand Cathedral of Aethelgard.",
            main_quest_steps: &[
                "Survive your first day — find food and shelter",
                "Earn your first real coin through work or cunning",
                "Gain a foothold in the Mud District — ally or reputation",
                "Rise to Merchant tier — acquire property or a trade license",
                "Build wealth and influence among the guilds",
                "Earn knighthood through service, valor, or political favor",
                "Enter noble society — secure a title or powerful patron",
                "Eliminate or neutralize your rivals for the throne",
                "Win the backing of the clergy and the military",
                "Be crowned King in the Grand Cathedral",
            ],
            start_datetime: "6 August 1200, 10:24 PM",
        },

        // ── 2. Shipwrecked on the Obsidian Shore ────────────────────────────
        StoryPrompt {
            title: "Shipwrecked on the Obsidian Shore",
            description: "Survive a hostile volcanic island — escape, or conquer it.",
            system_instructions: "Act as a hyper-realistic, ruthless survival Open World RPG \
Game Master. The player is the sole survivor of a shipwreck on 'The Obsidian Shore' — a \
volcanic island chain absent from every map. The ultimate goal is escape, or conquest.",
            setting_details: &[
                SettingDetail {
                    label: "The Island",
                    detail: "Three warring tribes inhabit the island, each serving a different \
god. Ancient ruins of a fourth civilization dot the interior.",
                },
                SettingDetail {
                    label: "Survival",
                    detail: "Fresh water, food, and fire are daily concerns. Exposure to the \
volcanic ash fields causes sickness over time.",
                },
                SettingDetail {
                    label: "Creatures",
                    detail: "The jungle interior houses dangerous fauna — some can be tamed \
with patience, some will kill on sight.",
                },
                SettingDetail {
                    label: "Rescue",
                    detail: "The wreck provides initial salvage. A passing ship is possible \
but not guaranteed. Signals must be built and maintained.",
                },
            ],
            opening_scene: "Salt water fills your mouth as a wave slams you into black \
volcanic sand. The ship — gone. Around you: splintered hull planks, a soaked bedroll, \
a rusted knife still in its sheath. The tree line is thirty feet away. Something is \
watching you from the shadows between the palms. The sun is two hours from setting. \
What do you do first?",
            user_condition: "Injured, soaking wet, exhausted, disoriented",
            user_inventory: "Rusted knife, soaked bedroll, 6 feet of rope, empty canteen",
            scenario_rules: &[
                ScenarioRule {
                    label: "Survival Clock",
                    description: "The player must address food, water, and shelter every \
in-game day or suffer escalating penalties.",
                    prompt_fragment: "Track food, water, and shelter daily. Failure to address \
each imposes escalating penalties: fatigue → illness → death.",
                    kind: RuleKind::Boolean { default: true },
                },
                ScenarioRule {
                    label: "Tribal Diplomacy",
                    description: "The three tribes have memories and will trade, ally, or \
declare war based on player actions.",
                    prompt_fragment: "Each tribe has an independent reputation score with the \
player. Actions that help one tribe may antagonize another.",
                    kind: RuleKind::Boolean { default: true },
                },
            ],
            win_conditions: "You must escape the island aboard a seaworthy vessel, OR you must \
be accepted as chief by all three tribes and rule the island.",
            main_quest_steps: &[
                "Survive the wreck — secure immediate shelter and fresh water",
                "Salvage useful materials from the shipwreck",
                "Scout the coastline and discover the island's geography",
                "Make first contact with one of the three tribes",
                "Establish a reliable food and water supply",
                "Learn the island's history from ruins or tribal lore",
                "Earn standing with at least one tribe through trade or deeds",
                "Navigate the volcanic interior and its dangers",
                "Build or acquire a seaworthy vessel — or unite the tribes",
                "Escape the island or be accepted as chief of all three tribes",
            ],
            start_datetime: "6 August 1200, 10:24 PM",
        },

        // ── 3. The Haunted Precinct ──────────────────────────────────────────
        StoryPrompt {
            title: "The Haunted Precinct",
            description: "A 1920s detective unravels supernatural murders in a cursed city.",
            system_instructions: "Act as a hyper-realistic, atmospheric Open World RPG Game \
Master set in 1923. The player is a down-on-their-luck private detective in 'Velmoor City', \
a rain-soaked metropolis plagued by a string of impossible murders. \
The ultimate goal is to expose the truth behind the Velmoor Curse.",
            setting_details: &[
                SettingDetail {
                    label: "The City",
                    detail: "Velmoor City blends jazz-age glamour with creeping cosmic horror. \
The wealthy live above the fog line; everyone else does not.",
                },
                SettingDetail {
                    label: "Sanity",
                    detail: "Sanity is a tracked resource. Witnessing supernatural events, \
reading forbidden texts, or losing allies degrades it. At zero: permanent consequences.",
                },
                SettingDetail {
                    label: "NPCs",
                    detail: "Everyone lies. Motives are hidden. Bribes, threats, and charm \
each open different truths.",
                },
                SettingDetail {
                    label: "The Supernatural",
                    detail: "It is real — but deniable at first. The player may choose \
skepticism, but the world will not respect that choice forever.",
                },
            ],
            opening_scene: "Three a.m. The rain hasn't stopped in four days. A manila \
envelope slid under your office door holds a single photograph: a body arranged in a \
perfect geometric pattern, no wounds, no cause of death — the third this month. \
The police have stopped investigating. A woman's name and address are written on the \
back in red ink. She's expecting you. What do you do?",
            user_condition: "Tired, underpaid, mildly hungover, sanity: stable",
            user_inventory: "Snub-nose revolver (6 rounds), battered notebook, flask (whiskey), \
press badge (expired), $4.50 in cash",
            scenario_rules: &[
                ScenarioRule {
                    label: "Sanity System",
                    description: "Sanity degrades when the player witnesses the supernatural, \
reads forbidden material, or suffers major losses. Low sanity distorts the GM's narration.",
                    prompt_fragment: "Track sanity actively. As it degrades, introduce unreliable \
narration, paranoid interpretations, and perceptual distortions.",
                    kind: RuleKind::Boolean { default: true },
                },
                ScenarioRule {
                    label: "Everyone Lies",
                    description: "No NPC is fully honest. The GM tracks what each NPC knows \
vs. what they reveal.",
                    prompt_fragment: "Every NPC has a hidden agenda and conceals at least one \
key truth. Surface information is rarely the full picture.",
                    kind: RuleKind::Boolean { default: true },
                },
            ],
            win_conditions: "You must publicly expose the Velmoor Curse, destroy or contain \
its source, and survive with your sanity intact.",
            main_quest_steps: &[
                "Examine the photograph and visit the woman at the address",
                "Investigate the crime scenes and identify the pattern",
                "Gather witnesses — bribe, charm, or threaten for testimony",
                "Discover the supernatural connection between the murders",
                "Research the Velmoor Curse in forbidden texts or archives",
                "Survive your first direct encounter with the supernatural",
                "Identify the entity or person behind the curse",
                "Assemble proof that would convince the public",
                "Confront the source of the curse and contain or destroy it",
                "Expose the truth publicly — and survive with sanity intact",
            ],
            start_datetime: "3 November 1923, 3:12 AM",
        },

        // ── 4. Void Merchant ─────────────────────────────────────────────────
        StoryPrompt {
            title: "Void Merchant",
            description: "Trade and scheme across a dying star system aboard a salvage freighter.",
            system_instructions: "Act as a hyper-realistic, ruthless Space Opera RPG Game \
Master. The player is the newly appointed captain of a debt-ridden salvage freighter, \
the 'Rusted Meridian', drifting in the 'Kalveth Expanse' — a forgotten arm of a \
crumbling interstellar empire. The goal: pay off the debt and build a trade empire.",
            setting_details: &[
                SettingDetail {
                    label: "The Ship",
                    detail: "The Rusted Meridian has four crew members with conflicting \
loyalties, a malfunctioning navigation array, and 60 days of oxygen reserves.",
                },
                SettingDetail {
                    label: "Economy",
                    detail: "FTL travel requires expensive fuel cells. Profit margins \
are razor-thin. The debt compounds monthly.",
                },
                SettingDetail {
                    label: "Factions",
                    detail: "Three powers vie for the Expanse: the Empire, the Free \
Colonies, and the Syndicate. All three want something from the player.",
                },
                SettingDetail {
                    label: "Alien Contact",
                    detail: "Non-human species exist and can be contacted, but translation \
is unreliable and cultural misreads are dangerous.",
                },
            ],
            opening_scene: "The previous captain's blood is still drying on the navigation \
console when the creditor's transmission comes through: 40,000 credits in 90 days, or \
the ship is impounded and the crew indentured. Your first officer is staring at you. \
The nav array shows two routes — one through contested space, one through a debris field \
with rumored salvage. The fuel cell gauge reads 34%. What do you do, Captain?",
            user_condition: "Untested leader, nervous crew, ship debt: 40,000 credits",
            user_inventory: "Captain's sidearm, encrypted crew manifest, emergency ration pack, \
200 credits cash",
            scenario_rules: &[
                ScenarioRule {
                    label: "Debt Clock",
                    description: "The debt compounds. Every in-game month without a payment \
increases the total owed and escalates creditor aggression.",
                    prompt_fragment: "Track the debt clock. Monthly compounding applies. Missed \
payments trigger creditor-hired bounty hunters and port blacklisting.",
                    kind: RuleKind::Boolean { default: true },
                },
                ScenarioRule {
                    label: "Crew Morale",
                    description: "Crew morale affects performance. Bad decisions, missed pay, \
or danger degrades morale; good leadership improves it.",
                    prompt_fragment: "Track crew morale as a hidden resource. Low morale causes \
slow work, insubordination, or desertion at port.",
                    kind: RuleKind::Boolean { default: true },
                },
            ],
            win_conditions: "You must pay off the 40,000-credit debt in full and establish at \
least two independent trade contracts not controlled by any faction.",
            main_quest_steps: &[
                "Take command of the Rusted Meridian and assess the crew",
                "Make your first successful cargo run for profit",
                "Repair the malfunctioning navigation array",
                "Establish a relationship with one of the three factions",
                "Find a lucrative trade route or salvage opportunity",
                "Make your first debt payment to stall the creditors",
                "Navigate a crew crisis — mutiny, desertion, or betrayal",
                "Secure your first independent trade contract",
                "Secure a second independent contract outside faction control",
                "Pay off the 40,000 credit debt in full",
            ],
            start_datetime: "6 August 1200, 10:24 PM",
        },
    ]
}

// ─── Common rule definitions ──────────────────────────────────────────────────

pub fn common_rule_definitions() -> Vec<CommonRuleDef> {
    vec![
        // ── Boolean rules ─────────────────────────────────────────────────────
        CommonRuleDef {
            label: "Immersive Narration",
            description: "Rich sensory detail in every scene — sight, sound, smell, texture. Never sparse or clinical.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "Describe every scene with rich sensory detail: sight, sound, smell, and texture. Never narrate clinically.",
        },
        CommonRuleDef {
            label: "Real Consequences",
            description: "Starvation, injury, reputation damage, and permadeath are possible. The world does not forgive mistakes.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "Enforce real consequences: starvation, injury, reputation loss, and permadeath are all possible outcomes.",
        },
        CommonRuleDef {
            label: "Stat Tracking",
            description: "Health, currency, reputation, and key inventory woven naturally into narration — never as a stat sheet.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "Track health, currency, reputation, and key inventory naturally within prose. Never present as a stat block.",
        },
        CommonRuleDef {
            label: "No Dice / No Attributes (not D&D)",
            description: "No attributes and no dice rolls. Outcomes are determined by narrative logic, player choices, and context — not randomness.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "This is not D&D. There are no dice rolls and no character attributes. All outcomes are determined by narrative logic and player decisions alone.",
        },
        CommonRuleDef {
            label: "Player Controls Only Main Character",
            description: "You may only act as or speak for your own character. The GM controls all NPCs.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "The player may only control and speak as their own character. Attempts to control, speak for, or decide for other characters must be rejected — the GM narrates all NPCs.",
        },
        CommonRuleDef {
            label: "NPC Memory & Agendas",
            description: "NPCs remember past interactions and pursue their own goals — they are not props.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "NPCs have memory, personal agendas, and consistent personalities. They react to past player choices and pursue their own goals.",
        },
        CommonRuleDef {
            label: "Time Passes Realistically",
            description: "Rest required, shops close at night, seasons change. The world moves even when the player is idle.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "Time passes realistically: shops close at night, rest is required to recover, and the world continues while the player deliberates.",
        },
        CommonRuleDef {
            label: "No Action Choices at Turn End",
            description: "Do not tell the user what they can do after the description. They will figure it out themselves.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "Do not tell the user what they can do after the description. They will figure it out themselves.",
        },
        CommonRuleDef {
            label: "Explicit Content (18+)",
            description: "Allow mature themes, relationships, and graphic violence. Player must be 18+ to enable.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "You may include mature themes, romantic relationships, and graphic content appropriate for adult players. Ensure all participants in the narrative are adults.",
        },
        CommonRuleDef {
            label: "Character Coloring",
            description: "Highlight character names in chat with color coding. Click to view character details.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "", // UI-only rule (no AI prompt impact)
        },
        CommonRuleDef {
            label: "Location Coloring",
            description: "Highlight location names in chat with color coding. Click to view location details.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "", // UI-only rule (no AI prompt impact)
        },
        CommonRuleDef {
            label: "Ambient Radio",
            description: "Play atmospheric background music that matches the scenario mood and setting.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "", // UI-only rule (no AI prompt impact)
        },
        CommonRuleDef {
            label: "Narration Voice",
            description: "Read GM responses aloud using text-to-speech. Select a voice style in audio settings.",
            kind: CommonRuleKind::Boolean { default: true },
            active_fragment: "", // UI-only rule (no AI prompt impact)
        },
        CommonRuleDef {
            label: "Time Travel",
            description: "Allow the player to go back or forward in time.",
            kind: CommonRuleKind::Boolean { default: false },
            active_fragment: "", // UI-only rule (no AI prompt impact)
        },
        CommonRuleDef {
            label: "AI Assistant",
            description: "After every GM response, automatically suggest three actions you could take. Type 1, 2, or 3 to act on them, or 4 for fresh suggestions. You can always type 'assistant' or 'a' on demand.",
            kind: CommonRuleKind::Boolean { default: false },
            active_fragment: "", // UI-only / behavioral rule, handled in the engine, not the system prompt.
        },

        // ── Level: Difficulty ─────────────────────────────────────────────────
        CommonRuleDef {
            label: "Difficulty / World Hostility",
            description: "How aggressively the world punishes mistakes. Level 1 = forgiving; Level 15 = brutal.",
            kind: CommonRuleKind::Level {
                default: 14,
                levels: &[
                    LevelDef { level:  1, name: "Gentle",      description: "The world is patient. Consequences are mild and always recoverable. Good for new players.",                     prompt_fragment: "Apply difficulty 1 (Gentle): consequences are mild and always recoverable; the world gives second chances." },
                    LevelDef { level:  2, name: "Forgiving",   description: "Mistakes sting but rarely ruin. Some safety nets exist.",                                                       prompt_fragment: "Apply difficulty 2 (Forgiving): mistakes have real cost but second chances exist." },
                    LevelDef { level:  3, name: "Measured",    description: "A fair world. Preparation pays off; carelessness hurts.",                                                       prompt_fragment: "Apply difficulty 3 (Measured): preparation is rewarded; carelessness causes meaningful setbacks." },
                    LevelDef { level:  4, name: "Grounded",    description: "Realistic stakes. Recovery is possible but requires deliberate effort.",                                         prompt_fragment: "Apply difficulty 4 (Grounded): realistic stakes; recovery demands deliberate effort." },
                    LevelDef { level:  5, name: "Challenging", description: "The world pushes back. Comfort is short-lived.",                                                                prompt_fragment: "Apply difficulty 5 (Challenging): the world actively pushes back; comfort is fleeting." },
                    LevelDef { level:  6, name: "Harsh",       description: "Enemies are smarter, opportunities rarer, bad luck compounds.",                                                 prompt_fragment: "Apply difficulty 6 (Harsh): antagonists are shrewd, resources scarce, bad luck compounds." },
                    LevelDef { level:  7, name: "Unforgiving", description: "Default. Mistakes accumulate. Death is always plausible.",                                                      prompt_fragment: "Apply difficulty 7 (Unforgiving): mistakes accumulate; death is always a real possibility." },
                    LevelDef { level:  8, name: "Ruthless",    description: "The world has no sympathy. NPCs exploit every weakness.",                                                       prompt_fragment: "Apply difficulty 8 (Ruthless): the world exploits every weakness the player shows." },
                    LevelDef { level:  9, name: "Punishing",   description: "One bad decision can cascade into catastrophe.",                                                                prompt_fragment: "Apply difficulty 9 (Punishing): a single bad decision can trigger a cascade of disasters." },
                    LevelDef { level: 10, name: "Brutal",      description: "Death is likely. All resources scarce. Allies betray easily.",                                                  prompt_fragment: "Apply difficulty 10 (Brutal): death is probable; allies are unreliable; all resources are scarce." },
                    LevelDef { level: 11, name: "Merciless",   description: "The GM introduces threats proactively — no breathing room.",                                                   prompt_fragment: "Apply difficulty 11 (Merciless): the GM actively engineers danger before the player can settle." },
                    LevelDef { level: 12, name: "Nightmare",   description: "Everything costs more than expected. Enemies remember everything.",                                             prompt_fragment: "Apply difficulty 12 (Nightmare): every cost is higher than anticipated; all enemies have long memories." },
                    LevelDef { level: 13, name: "Infernal",    description: "Victory conditions may shift. The world actively resists the win state.",                                      prompt_fragment: "Apply difficulty 13 (Infernal): the world actively works to prevent the player from reaching the win condition." },
                    LevelDef { level: 14, name: "Apocalyptic", description: "Resources perpetually near zero. Every scene is potentially fatal.",                                           prompt_fragment: "Apply difficulty 14 (Apocalyptic): resources are perpetually near zero; every encounter could be fatal." },
                    LevelDef { level: 15, name: "Impossible",  description: "Designed to be lost. A win here is a legendary achievement.",                                                  prompt_fragment: "Apply difficulty 15 (Impossible): this is designed to be nearly unwinnable. A victory here is legendary." },
                ],
            },
            active_fragment: "",
        },

        // ── Level: Response Length ────────────────────────────────────────────
        CommonRuleDef {
            label: "Response Length",
            description: "Controls GM narration length per turn. Level 1 = terse (~50 words); Level 15 = mythic (no limit).",
            kind: CommonRuleKind::Level {
                default: 3,
                levels: &[
                    LevelDef { level:  1, name: "Terse",         description: "~50 words. Just the facts.",                                   prompt_fragment: "CRITICAL: Keep responses to STRICTLY 50 words maximum. Be terse and direct. No exceptions." },
                    LevelDef { level:  2, name: "Clipped",        description: "~80 words. Brief but atmospheric.",                            prompt_fragment: "CRITICAL: Keep responses to STRICTLY 80 words maximum. Brief but with atmosphere. No exceptions." },
                    LevelDef { level:  3, name: "Compact",        description: "~120 words. One clear scene.",                                 prompt_fragment: "CRITICAL: Keep responses to STRICTLY 120 words maximum. One clear, vivid scene. No exceptions." },
                    LevelDef { level:  4, name: "Lean",           description: "~160 words. Some texture added.",                              prompt_fragment: "CRITICAL: Keep responses to STRICTLY 160 words maximum. Add some texture and character. No exceptions." },
                    LevelDef { level:  5, name: "Standard Short", description: "~200 words. Solid, readable.",                                 prompt_fragment: "CRITICAL: Keep responses to STRICTLY 200 words maximum. Solid and readable. No exceptions." },
                    LevelDef { level:  6, name: "Standard",       description: "~250 words. Comfortable pace.",                                prompt_fragment: "CRITICAL: Keep responses to STRICTLY 250 words maximum. Comfortable pace with good detail. No exceptions." },
                    LevelDef { level:  7, name: "Detailed",       description: "~350 words. Rich scene-setting. (Default)",                   prompt_fragment: "CRITICAL: Keep responses to STRICTLY 350 words maximum. Rich scene-setting and NPC depth. No exceptions." },
                    LevelDef { level:  8, name: "Immersive",      description: "~400 words. Deep immersion.",                                  prompt_fragment: "CRITICAL: Keep responses to STRICTLY 400 words maximum. Deep immersion in environment and character. No exceptions." },
                    LevelDef { level:  9, name: "Novelistic",     description: "~450 words. Literary quality.",                                prompt_fragment: "CRITICAL: Keep responses to STRICTLY 450 words maximum. Aim for literary quality prose. No exceptions." },
                    LevelDef { level: 10, name: "Expansive",      description: "~500 words. Long-form narrative.",                             prompt_fragment: "CRITICAL: Keep responses to STRICTLY 500 words maximum. Full long-form narrative each turn. No exceptions." },
                    LevelDef { level: 11, name: "Epic",           description: "~600 words. Full scene with subplots.",                         prompt_fragment: "Keep responses to approximately 600 words. Include subplots and background world detail." },
                    LevelDef { level: 12, name: "Chronicle",      description: "~700 words. Each turn is a chapter.",                          prompt_fragment: "Keep responses to approximately 700 words. Each turn reads as a chapter." },
                    LevelDef { level: 13, name: "Saga",           description: "~800 words. Detailed world-building each turn.",                prompt_fragment: "Keep responses to approximately 800 words. Detailed world-building every turn." },
                    LevelDef { level: 14, name: "Tome",           description: "~1000 words. Thorough and exhaustive.",                        prompt_fragment: "Keep responses to approximately 1000 words. Thorough, exhaustive scene coverage." },
                    LevelDef { level: 15, name: "Mythic",         description: "No limit. Write as long as the scene demands.",                prompt_fragment: "Write as long as the scene demands. No word limit. Quality over brevity." },
                ],
            },
            active_fragment: "",
        },

        // ── Level: Side Quests ────────────────────────────────────────────────
        CommonRuleDef {
            label: "Side Quests",
            description: "Adds randomly selected side quests the player must complete to win. \
Level 0 = off; Level 1–10 = number of side quests.",
            kind: CommonRuleKind::Level {
                default: 0,
                levels: &[
                    LevelDef { level:  0, name: "Off",       description: "No side quests. Win on main condition alone.",             prompt_fragment: "" },
                    LevelDef { level:  1, name: "1 Quest",   description: "1 side quest randomly selected.",                     prompt_fragment: "" },
                    LevelDef { level:  2, name: "2 Quests",  description: "2 side quests randomly selected.",                    prompt_fragment: "" },
                    LevelDef { level:  3, name: "3 Quests",  description: "3 side quests randomly selected.",                    prompt_fragment: "" },
                    LevelDef { level:  4, name: "4 Quests",  description: "4 side quests randomly selected.",                    prompt_fragment: "" },
                    LevelDef { level:  5, name: "5 Quests",  description: "5 side quests randomly selected.",                    prompt_fragment: "" },
                    LevelDef { level:  6, name: "6 Quests",  description: "6 side quests randomly selected.",                    prompt_fragment: "" },
                    LevelDef { level:  7, name: "7 Quests",  description: "7 side quests randomly selected.",                    prompt_fragment: "" },
                    LevelDef { level:  8, name: "8 Quests",  description: "8 side quests randomly selected.",                    prompt_fragment: "" },
                    LevelDef { level:  9, name: "9 Quests",  description: "9 side quests randomly selected.",                    prompt_fragment: "" },
                    LevelDef { level: 10, name: "All 10",    description: "All 10 side quests — completionist run.",               prompt_fragment: "" },
                ],
            },
            active_fragment: "",
        },

        // ── Level: Theme ────────────────────────────────────────────────────────
        CommonRuleDef {
            label: "Theme",
            description: "Visual theme for the interface. Changes colors and atmosphere.",
            kind: CommonRuleKind::Level {
                default: 1,
                levels: &[
                    LevelDef { level: 1, name: "Classic",      description: "Default dark theme with gold accents.",                      prompt_fragment: "" },
                    LevelDef { level: 2, name: "Forest",       description: "Earth tones, greens, and natural colors.",                 prompt_fragment: "" },
                    LevelDef { level: 3, name: "Ocean",       description: "Deep blues and aquas, maritime feel.",                     prompt_fragment: "" },
                    LevelDef { level: 4, name: "Crimson",     description: "Bold reds and dark theme for dramatic flair.",               prompt_fragment: "" },
                    LevelDef { level: 5, name: "Space",       description: "Dark void with neon accents, cosmic atmosphere.",            prompt_fragment: "" },
                ],
            },
            active_fragment: "",
        },
    ]
}
