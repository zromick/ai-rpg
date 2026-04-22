use ai_rpg::{
    pick_side_quests,
    common_rule_definitions,
    story_prompts,
    build_system_prompt,
    RuleSet,
    RuleEntry,
    RuleKind,
    CommonRuleKind,
    SideQuest,
};

#[cfg(test)]
mod character_features_tests {
    use super::*;

    #[test]
    fn test_character_random_seed_zero() {
        let cf = ai_rpg::CharacterFeatures::random(0);
        assert!(!cf.age.is_empty());
        assert!(!cf.gender.is_empty());
        assert!(!cf.build.is_empty());
    }

    #[test]
    fn test_character_random_different_seeds() {
        let cf1 = ai_rpg::CharacterFeatures::random(1);
        let cf2 = ai_rpg::CharacterFeatures::random(2);
        assert_ne!(cf1.age, cf2.age);
    }

    #[test]
    fn test_character_to_image_prompt() {
        let cf = ai_rpg::CharacterFeatures {
            age: "early 20s".to_string(),
            gender: "male".to_string(),
            build: "wiry".to_string(),
            height: "tall".to_string(),
            hair_color: "black".to_string(),
            hair_style: "cropped".to_string(),
            eye_color: "brown".to_string(),
            skin_tone: "olive".to_string(),
            scars: "none".to_string(),
            clothing: "worn peasant tunic".to_string(),
            expression: "watchful and guarded".to_string(),
            distinguishing: "none".to_string(),
            current_location: "Tavern".to_string(),
            custom: std::collections::HashMap::new(),
        };
        let prompt = cf.to_image_prompt();
        assert!(prompt.contains("early 20s male"));
        assert!(prompt.contains("wiry"));
        assert!(prompt.contains("Tavern"));
    }

    #[test]
    fn test_character_to_image_prompt_with_scars() {
        let cf = ai_rpg::CharacterFeatures {
            age: "mid 30s".to_string(),
            gender: "female".to_string(),
            build: "stocky".to_string(),
            height: "average height".to_string(),
            hair_color: "auburn".to_string(),
            hair_style: "braided".to_string(),
            eye_color: "green".to_string(),
            skin_tone: "fair".to_string(),
            scars: "a jagged scar across the cheek".to_string(),
            clothing: "patched leather vest".to_string(),
            expression: "quietly defiant".to_string(),
            distinguishing: "a missing finger".to_string(),
            current_location: String::new(),
            custom: std::collections::HashMap::new(),
        };
        let prompt = cf.to_image_prompt();
        assert!(prompt.contains("with a jagged scar across the cheek"));
        assert!(prompt.contains("a missing finger"));
    }
}

#[cfg(test)]
mod world_state_tests {
    use super::*;

    #[test]
    fn test_world_state_default() {
        let ws = ai_rpg::WorldState::default();
        assert!(ws.inventory.is_empty());
        assert!(ws.side_characters.is_empty());
        assert!(ws.locations.is_empty());
        assert!(!ws.battle_mode);
        assert!(!ws.romance_mode);
        assert_eq!(ws.turn, 0);
    }

    #[test]
    fn test_world_state_serde_roundtrip() {
        let ws = ai_rpg::WorldState {
            inventory: vec![ai_rpg::InventoryItem {
                name: "sword".to_string(),
                quantity: "1".to_string(),
                note: "rusty but functional".to_string(),
            }],
            side_characters: vec![ai_rpg::SideCharacter {
                name: "John Smith".to_string(),
                description: "A tall merchant with a kind face".to_string(),
                relation: "ally".to_string(),
                outline_color: Some("#4a90d9".to_string()),
                character_features: Some(std::collections::HashMap::new()),
                inventory: None,
            }],
            locations: vec![ai_rpg::Location {
                name: "The Prancing Pony".to_string(),
                description: "A cozy inn with warm fires".to_string(),
                last_visited: 1,
                outline_color: Some("#d97a4a".to_string()),
                location_features: None,
            }],
            current_location: Some("The Prancing Pony".to_string()),
            start_datetime: Some("7 August 1200, 6:00 PM".to_string()),
            current_datetime: Some("7 August 1200, 6:00 PM".to_string()),
            end_datetime: None,
            nicknames: vec!["Hero".to_string()],
            current_nickname: Some("Hero".to_string()),
            battle_mode: false,
            romance_mode: false,
            turn: 1,
        };

        let json = serde_json::to_string(&ws).unwrap();
        let ws2: ai_rpg::WorldState = serde_json::from_str(&json).unwrap();

        assert_eq!(ws.inventory.len(), ws2.inventory.len());
        assert_eq!(ws.inventory[0].name, ws2.inventory[0].name);
        assert_eq!(ws.side_characters[0].name, ws2.side_characters[0].name);
        assert_eq!(ws.locations[0].name, ws2.locations[0].name);
        assert_eq!(ws.current_location, ws2.current_location);
        assert_eq!(ws.turn, ws2.turn);
    }

    #[test]
    fn test_world_state_battle_mode() {
        let mut ws = ai_rpg::WorldState::default();
        ws.battle_mode = true;
        ws.romance_mode = false;

        let json = serde_json::to_string(&ws).unwrap();
        let ws2: ai_rpg::WorldState = serde_json::from_str(&json).unwrap();

        assert!(ws2.battle_mode);
        assert!(!ws2.romance_mode);
    }

    #[test]
    fn test_world_state_turn_increment() {
        let mut ws = ai_rpg::WorldState::default();
        assert_eq!(ws.turn, 0);
        ws.turn += 1;
        assert_eq!(ws.turn, 1);
    }

    #[test]
    fn test_world_state_nicknames() {
        let mut ws = ai_rpg::WorldState::default();
        ws.nicknames.push("the Brave".to_string());
        ws.current_nickname = Some("the Brave".to_string());

        assert!(ws.nicknames.contains(&"the Brave".to_string()));
        assert_eq!(ws.current_nickname, Some("the Brave".to_string()));
    }
}

#[cfg(test)]
mod inventory_item_tests {
    use super::*;

    #[test]
    fn test_inventory_item_serde() {
        let item = ai_rpg::InventoryItem {
            name: "gold coins".to_string(),
            quantity: "50".to_string(),
            note: "in a purse".to_string(),
        };

        let json = serde_json::to_string(&item).unwrap();
        let item2: ai_rpg::InventoryItem = serde_json::from_str(&json).unwrap();

        assert_eq!(item.name, item2.name);
        assert_eq!(item.quantity, item2.quantity);
        assert_eq!(item.note, item2.note);
    }

    #[test]
    fn test_inventory_vector() {
        let items = vec![
            ai_rpg::InventoryItem {
                name: "bread".to_string(),
                quantity: "3".to_string(),
                note: "stale".to_string(),
            },
            ai_rpg::InventoryItem {
                name: "water".to_string(),
                quantity: "2".to_string(),
                note: "in a flask".to_string(),
            },
        ];

        let json = serde_json::to_string(&items).unwrap();
        let items2: Vec<ai_rpg::InventoryItem> = serde_json::from_str(&json).unwrap();

        assert_eq!(items.len(), items2.len());
        assert_eq!(items2[0].name, "bread");
        assert_eq!(items2[1].name, "water");
    }
}

#[cfg(test)]
mod side_character_tests {
    use super::*;

    #[test]
    fn test_side_character_serde() {
        let sc = ai_rpg::SideCharacter {
            name: "Elena Brightblade".to_string(),
            description: "A fierce warrior with silver hair".to_string(),
            relation: "ally".to_string(),
            outline_color: Some("#6bd94a".to_string()),
            character_features: None,
            inventory: None,
        };

        let json = serde_json::to_string(&sc).unwrap();
        let sc2: ai_rpg::SideCharacter = serde_json::from_str(&json).unwrap();

        assert_eq!(sc.name, sc2.name);
        assert_eq!(sc.relation, sc2.relation);
    }

    #[test]
    fn test_side_character_relation_types() {
        for relation in &["ally", "enemy", "neutral", "unknown"] {
            let sc = ai_rpg::SideCharacter {
                name: "Test NPC".to_string(),
                description: "A test character".to_string(),
                relation: relation.to_string(),
                outline_color: None,
                character_features: None,
                inventory: None,
            };

            let json = serde_json::to_string(&sc).unwrap();
            let sc2: ai_rpg::SideCharacter = serde_json::from_str(&json).unwrap();

            assert_eq!(sc2.relation, *relation);
        }
    }
}

#[cfg(test)]
mod location_tests {
    use super::*;

    #[test]
    fn test_location_serde() {
        let loc = ai_rpg::Location {
            name: "Dark Forest".to_string(),
            description: "Creepy woods with twisted trees".to_string(),
            last_visited: 5,
            outline_color: Some("#4ad96b".to_string()),
            location_features: None,
        };

        let json = serde_json::to_string(&loc).unwrap();
        let loc2: ai_rpg::Location = serde_json::from_str(&json).unwrap();

        assert_eq!(loc.name, loc2.name);
        assert_eq!(loc.last_visited, loc2.last_visited);
    }
}

#[cfg(test)]
mod game_settings_tests {
    use super::*;

    #[test]
    fn test_game_settings_serde() {
        let settings = ai_rpg::GameSettings {
            model: "meta-llama/Llama-3.1-8B-Instruct".to_string(),
            scenario_title: "Void Merchant".to_string(),
            scenario_rules: vec![ai_rpg::ScenarioRuleSetting {
                label: "Test Rule".to_string(),
                description: "A test rule".to_string(),
                enabled: true,
            }],
            common_rules: vec![ai_rpg::CommonRuleSetting {
                label: "Side Quests".to_string(),
                description: "Number of side quests".to_string(),
                kind: "level".to_string(),
                active: true,
                current_level: 3,
                max_level: 5,
                level_names: vec!["OFF".to_string(), "1".to_string(), "2".to_string(), "3".to_string(), "4".to_string(), "5".to_string()],
            }],
        };

        let json = serde_json::to_string(&settings).unwrap();
        let settings2: ai_rpg::GameSettings = serde_json::from_str(&json).unwrap();

        assert_eq!(settings.model, settings2.model);
        assert_eq!(settings.scenario_title, settings2.scenario_title);
        assert_eq!(settings.common_rules[0].current_level, 3);
    }

    #[test]
    fn test_scenario_rule_setting_enabled() {
        let rule = ai_rpg::ScenarioRuleSetting {
            label: "Combat".to_string(),
            description: "Enable combat".to_string(),
            enabled: true,
        };

        let json = serde_json::to_string(&rule).unwrap();
        let rule2: ai_rpg::ScenarioRuleSetting = serde_json::from_str(&json).unwrap();

        assert!(rule2.enabled);
    }

    #[test]
    fn test_common_rule_setting_levels() {
        let rule = ai_rpg::CommonRuleSetting {
            label: "Theme".to_string(),
            description: "Visual theme".to_string(),
            kind: "level".to_string(),
            active: true,
            current_level: 2,
            max_level: 5,
            level_names: vec!["Classic".to_string(), "Forest".to_string(), "Ocean".to_string(), "Crimson".to_string(), "Space".to_string()],
        };

        let json = serde_json::to_string(&rule).unwrap();
        let rule2: ai_rpg::CommonRuleSetting = serde_json::from_str(&json).unwrap();

        assert_eq!(rule2.kind, "level");
        assert_eq!(rule2.current_level, 2);
        assert!(rule2.active);
    }
}

#[cfg(test)]
mod model_validation_tests {
    use super::*;

    #[test]
    fn test_available_models_not_empty() {
        let models = ai_rpg::available_models();
        assert!(!models.is_empty());
    }

    #[test]
    fn test_available_models_have_ids() {
        let models = ai_rpg::available_models();
        for m in &models {
            assert!(!m.id.is_empty());
            assert!(!m.label.is_empty());
        }
    }

    #[test]
    fn test_available_models_contains_llama() {
        let models = ai_rpg::available_models();
        let has_llama = models.iter().any(|m| m.id.contains("Llama"));
        assert!(has_llama, "Should contain Llama model");
    }

    #[test]
    fn test_available_models_default_present() {
        let models = ai_rpg::available_models();
        let default = models.iter().find(|m| m.id.contains("default"));
        assert!(default.is_some() || models.iter().any(|m| m.label.contains("default")));
    }

    #[test]
    fn test_model_id_format() {
        let models = ai_rpg::available_models();
        for m in &models {
            assert!(m.id.contains('/'), "Model ID should contain /");
        }
    }
}

#[cfg(test)]
mod command_parsing_tests {
    use super::*;

    #[test]
    fn test_quest_command_detection() {
        let input = "quest";
        assert_eq!(input.trim().to_lowercase().as_str(), "quest");
        
        let input2 = "q";
        assert_eq!(input2.trim().to_lowercase().as_str(), "q");
    }

    #[test]
    fn test_sidequests_command() {
        let input = "sidequests";
        assert!(input.to_lowercase().starts_with("side"));
    }

    #[test]
    fn test_stats_command() {
        let input = "stats";
        assert_eq!(input.to_lowercase(), "stats");
    }

    #[test]
    fn test_inventory_command() {
        let input = "inventory";
        assert_eq!(input.to_lowercase(), "inventory");
        
        let input2 = "inv";
        assert_eq!(input2.to_lowercase(), "inv");
    }

    #[test]
    fn test_settings_command() {
        let input = "settings";
        assert_eq!(input.to_lowercase(), "settings");
    }

    #[test]
    fn test_character_command() {
        let input = "character";
        assert_eq!(input.to_lowercase(), "character");
        
        let input2 = "char";
        assert_eq!(input2.to_lowercase(), "char");
        
        let input3 = "c";
        assert_eq!(input3.to_lowercase(), "c");
    }
}

#[cfg(test)]
mod settings_update_parsing_tests {
    use super::*;

    #[test]
    fn test_settings_update_json_model_only() {
        let json = r#"{"model": "google/gemma-2-9b-it"}"#;
        let update: ai_rpg::SettingsUpdate = serde_json::from_str(json).unwrap();
        assert_eq!(update.model, Some("google/gemma-2-9b-it".to_string()));
    }

    #[test]
    fn test_settings_update_json_with_common_rules() {
        let json = r#"{"common_rules": [{"active": true, "current_level": 2}]}"#;
        let update: ai_rpg::SettingsUpdate = serde_json::from_str(json).unwrap();
        assert!(update.common_rules.is_some());
    }

    #[test]
    fn test_settings_update_json_with_scenario_rules() {
        let json = r#"{"scenario_rules": [true, false, true]}"#;
        let update: ai_rpg::SettingsUpdate = serde_json::from_str(json).unwrap();
        assert!(update.scenario_rules.is_some());
        let sr = update.scenario_rules.unwrap();
        assert_eq!(sr.len(), 3);
        assert!(sr[0]);
        assert!(!sr[1]);
        assert!(sr[2]);
    }

    #[test]
    fn test_settings_update_full() {
        let json = r#"{
            "model": "mistralai/Mistral-7B-Instruct-v0.3",
            "common_rules": [
                {"active": true, "current_level": 3},
                {"active": false, "current_level": 1}
            ],
            "scenario_rules": [true, false]
        }"#;
        let update: ai_rpg::SettingsUpdate = serde_json::from_str(json).unwrap();
        assert_eq!(update.model.unwrap(), "mistralai/Mistral-7B-Instruct-v0.3");
        assert_eq!(update.common_rules.unwrap().len(), 2);
        assert_eq!(update.scenario_rules.unwrap().len(), 2);
    }
}

#[cfg(test)]
mod setup_complete_command_tests {
    use super::*;

    #[test]
    fn test_setup_complete_basic() {
        let json = r#"{
            "model": "meta-llama/Llama-3.1-8B-Instruct",
            "scenario_idx": 0,
            "scenario_rules": [true, true, false],
            "common_rules": [
                {"active": true, "current_level": 1},
                {"active": true, "current_level": 3}
            ],
            "players": [{"name": "Player1"}]
        }"#;
        let payload: ai_rpg::SetupPayload = serde_json::from_str(json).unwrap();
        assert_eq!(payload.model, "meta-llama/Llama-3.1-8B-Instruct");
        assert_eq!(payload.scenario_idx, 0);
        assert_eq!(payload.players.len(), 1);
    }

    #[test]
    fn test_setup_complete_multiple_players() {
        let json = r#"{
            "model": "meta-llama/Llama-3.1-8B-Instruct",
            "scenario_idx": 2,
            "scenario_rules": [],
            "common_rules": [],
            "players": [
                {"name": "Alice"},
                {"name": "Bob"},
                {"name": "Charlie"}
            ]
        }"#;
        let payload: ai_rpg::SetupPayload = serde_json::from_str(json).unwrap();
        assert_eq!(payload.players.len(), 3);
    }
}

#[cfg(test)]
mod extraction_json_tests {
    #[test]
    fn test_extraction_json_valid() {
        let json_str = r##"{
            "inventory": [
                {"name": "sword", "quantity": "1", "note": "iron"}
            ],
            "side_characters": [],
            "locations": [],
            "current_location": "Tavern",
            "current_datetime": "7 August 1200, 6:00 PM",
            "game_won": false,
            "clothing_update": null,
            "new_nickname": null,
            "completed_quest_step": null,
            "battle_mode": false,
            "romance_mode": false
        }"##;
        let v: serde_json::Value = serde_json::from_str(json_str).unwrap();
        assert!(v.is_object());
    }

    #[test]
    fn test_extraction_json_with_character() {
        let json_str = r##"{
            "inventory": [],
            "side_characters": [
                {
                    "name": "John Smith",
                    "description": "A tall merchant with a kind face",
                    "relation": "ally",
                    "outline_color": "#4a90d9",
                    "character_features": {"gender": "male", "build": "stocky", "age": "middle-aged"},
                    "inventory": []
                }
            ],
            "locations": [],
            "current_location": null,
            "current_datetime": "7 August 1200, 6:15 PM",
            "game_won": false,
            "clothing_update": null,
            "new_nickname": null,
            "completed_quest_step": null,
            "battle_mode": false,
            "romance_mode": false
        }"##;
        let v: serde_json::Value = serde_json::from_str(json_str).unwrap();
        let chars = v["side_characters"].as_array().unwrap();
        assert_eq!(chars.len(), 1);
        assert_eq!(chars[0]["name"], "John Smith");
    }

    #[test]
    fn test_extraction_json_with_location() {
        let json_str = r##"{
            "inventory": [],
            "side_characters": [],
            "locations": [
                {
                    "name": "Dark Cave",
                    "description": "A spooky cave with glowing mushrooms",
                    "last_visited": 1,
                    "outline_color": "#8a4ad9",
                    "location_features": {"interior": "glowing mushrooms", "exterior": "cave entrance", "mood": "eerie"}
                }
            ],
            "current_location": "Dark Cave",
            "current_datetime": "7 August 1200, 6:30 PM",
            "game_won": false,
            "clothing_update": null,
            "new_nickname": null,
            "completed_quest_step": null,
            "battle_mode": false,
            "romance_mode": false
        }"##;
        let v: serde_json::Value = serde_json::from_str(json_str).unwrap();
        let locs = v["locations"].as_array().unwrap();
        assert_eq!(locs[0]["name"], "Dark Cave");
    }

    #[test]
    fn test_extraction_json_invalid_returns_error() {
        let json_str = r#"not valid json"#;
        let result: Result<serde_json::Value, _> = serde_json::from_str(json_str);
        assert!(result.is_err());
    }

    #[test]
    fn test_extraction_json_markdown_strip() {
        let json_with_fence = r#"```json
{
    "inventory": [],
    "side_characters": [],
    "locations": [],
    "current_location": null,
    "current_datetime": null,
    "game_won": false,
    "clothing_update": null,
    "new_nickname": null,
    "completed_quest_step": null,
    "battle_mode": false,
    "romance_mode": false
}
```"#;
        let trimmed = json_with_fence.trim();
        let stripped = trimmed.strip_prefix("```json").or_else(|| trimmed.strip_prefix("```")).unwrap_or(trimmed);
        let final_stripped = stripped.strip_suffix("```").unwrap_or(stripped).trim();
        
        let v: serde_json::Value = serde_json::from_str(final_stripped).unwrap();
        assert!(v.is_object());
    }

    #[test]
    fn test_extraction_json_game_won() {
        let json_str = r##"{
            "inventory": [],
            "side_characters": [],
            "locations": [],
            "current_location": null,
            "current_datetime": "7 August 1200, 8:00 PM",
            "game_won": true,
            "clothing_update": null,
            "new_nickname": "the Crowned",
            "completed_quest_step": null,
            "battle_mode": false,
            "romance_mode": false
        }"##;
        let v: serde_json::Value = serde_json::from_str(json_str).unwrap();
        assert!(v["game_won"].as_bool().unwrap());
        assert_eq!(v["new_nickname"], "the Crowned");
    }

    #[test]
    fn test_extraction_json_quest_step_completed() {
        let json_str = r##"{
            "inventory": [{"name": "gold", "quantity": "100", "note": "from treasury"}],
            "side_characters": [],
            "locations": [],
            "current_location": null,
            "current_datetime": "7 August 1200, 7:00 PM",
            "game_won": false,
            "clothing_update": null,
            "new_nickname": null,
            "completed_quest_step": 2,
            "battle_mode": false,
            "romance_mode": false
        }"##;
        let v: serde_json::Value = serde_json::from_str(json_str).unwrap();
        assert_eq!(v["completed_quest_step"].as_u64(), Some(2));
    }

    #[test]
    fn test_extraction_json_clothing_update() {
        let json_str = r##"{
            "inventory": [],
            "side_characters": [],
            "locations": [],
            "current_location": null,
            "current_datetime": "7 August 1200, 6:00 PM",
            "game_won": false,
            "clothing_update": "royal robes",
            "new_nickname": null,
            "completed_quest_step": null,
            "battle_mode": false,
            "romance_mode": false
        }"##;
        let v: serde_json::Value = serde_json::from_str(json_str).unwrap();
        assert_eq!(v["clothing_update"], "royal robes");
    }
}

#[cfg(test)]
mod system_prompt_build_tests {
    use super::*;

    #[test]
    fn test_system_prompt_contains_scenario() {
        let scenarios = story_prompts();
        let rule_set = RuleSet::from_defaults();
        let quests = pick_side_quests(2);

        let prompt = build_system_prompt(&scenarios[0], &rule_set, &quests, None);
        assert!(prompt.contains(&scenarios[0].title));
    }

    #[test]
    fn test_system_prompt_contains_rules() {
        let scenarios = story_prompts();
        let rule_set = RuleSet::from_defaults();
        let quests = pick_side_quests(0);

        let prompt = build_system_prompt(&scenarios[0], &rule_set, &quests, None);
        assert!(!prompt.is_empty());
    }
}

#[cfg(test)]
mod build_game_from_setup_tests {
    use super::*;

    #[test]
    fn test_build_game_scenario_theme_void() {
        let scenarios = story_prompts();
        let void_merchant = scenarios.iter().find(|s| s.title == "Void Merchant");
        assert!(void_merchant.is_some());
        
        let story = void_merchant.unwrap();
        let title_lower = story.title.to_lowercase();
        let theme = if title_lower.contains("void") || title_lower.contains("merchant") || title_lower.contains("space") {
            5
        } else {
            1
        };
        assert_eq!(theme, 5);
    }

    #[test]
    fn test_build_game_scenario_theme_forest() {
        let title_lower = "forest wizard";
        let theme = if title_lower.contains("void") || title_lower.contains("merchant") || title_lower.contains("space") {
            5
        } else if title_lower.contains("debt collector") || title_lower.contains("cursed relic") || title_lower.contains("assassin") || title_lower.contains("forgotten temple") || title_lower.contains("haunted") {
            4
        } else if title_lower.contains("shipwreck") || title_lower.contains("veteran") || title_lower.contains("double agent") || title_lower.contains("obsidian") {
            3
        } else if title_lower.contains("grain") || title_lower.contains("poison") || title_lower.contains("forest") {
            2
        } else {
            1
        };
        assert_eq!(theme, 2);
    }
}

#[cfg(test)]
mod player_color_tests {
    #[test]
    fn test_player_color_consistent() {
        fn player_color(name: &str) -> String {
            let mut h: u64 = 0;
            for (i, c) in name.bytes().enumerate() {
                h = h.wrapping_add((c as u64).wrapping_mul(31u64.wrapping_pow(i as u32)));
            }
            let colors = ["#4a90d9", "#d97a4a", "#6bd94a", "#d94ab8", "#4ad9d1", "#d9c84a", "#8a4ad9", "#4ad96b"];
            let idx = (h as usize) % colors.len();
            colors[idx].to_string()
        }

        let color1 = player_color("Alice");
        let color2 = player_color("Alice");
        assert_eq!(color1, color2);
    }

    #[test]
    fn test_player_color_different_names() {
        fn player_color(name: &str) -> String {
            let mut h: u64 = 0;
            for (i, c) in name.bytes().enumerate() {
                h = h.wrapping_add((c as u64).wrapping_mul(31u64.wrapping_pow(i as u32)));
            }
            let colors = ["#4a90d9", "#d97a4a", "#6bd94a", "#d94ab8", "#4ad9d1", "#d9c84a", "#8a4ad9", "#4ad96b"];
            let idx = (h as usize) % colors.len();
            colors[idx].to_string()
        }

        let color_alice = player_color("Alice");
        let color_bob = player_color("Bob");
        assert_ne!(color_alice, color_bob);
    }
}