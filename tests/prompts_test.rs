use ai_rpg::{
    pick_side_quests,
    common_rule_definitions,
    story_prompts,
    build_system_prompt,
    RuleSet,
    CommonRuleKind,
};

#[test]
fn test_story_prompts_returns_vec() {
    let scenarios = story_prompts();
    assert!(!scenarios.is_empty());
}

#[test]
fn test_story_prompts_has_titles() {
    let scenarios = story_prompts();
    for scenario in &scenarios {
        assert!(!scenario.title.is_empty());
        assert!(!scenario.win_conditions.is_empty());
    }
}

#[test]
fn test_story_prompts_void_merchant_present() {
    let scenarios = story_prompts();
    let titles: Vec<&str> = scenarios.iter().map(|s| s.title).collect();
    assert!(titles.contains(&"Void Merchant"), "Void Merchant scenario should be present");
}

#[test]
fn test_side_quest_pool_has_quests() {
    let quests = pick_side_quests(3);
    assert_eq!(quests.len(), 3);
}

#[test]
fn test_side_quest_zero_count() {
    let quests = pick_side_quests(0);
    assert!(quests.is_empty());
}

#[test]
fn test_common_rule_definitions_has_rules() {
    let rules = common_rule_definitions();
    assert!(!rules.is_empty());
}

#[test]
fn test_common_rule_theme_has_five_levels() {
    let rules = common_rule_definitions();
    let theme_rule = rules.iter().find(|r| r.label == "Theme");
    assert!(theme_rule.is_some());
    match &theme_rule.unwrap().kind {
        CommonRuleKind::Level { levels, .. } => {
            assert_eq!(levels.len(), 5);
        }
        _ => panic!("Theme should be Level kind"),
    }
}

#[test]
fn test_common_rule_theme_space_level() {
    let rules = common_rule_definitions();
    let theme_rule = rules.iter().find(|r| r.label == "Theme").unwrap();
    match &theme_rule.kind {
        CommonRuleKind::Level { levels, .. } => {
            let space_level = levels.iter().find(|l| l.name == "Space");
            assert!(space_level.is_some(), "Space theme level should exist");
        }
        _ => panic!("Theme should be Level kind"),
    }
}

#[test]
fn test_build_system_prompt() {
    let scenarios = story_prompts();
    let rule_set = RuleSet::from_defaults();
    let quests = pick_side_quests(2);
    
    let first_scenario = &scenarios[0];
    let prompt = build_system_prompt(first_scenario, &rule_set, &quests, None);
    
    assert!(!prompt.is_empty());
    assert!(prompt.contains(first_scenario.title));
}

#[test]
fn test_ruleset_from_defaults() {
    let rule_set = RuleSet::from_defaults();
    assert!(!rule_set.entries.is_empty());
    
    let active_rules: Vec<_> = rule_set.entries.iter().filter(|e| e.active).collect();
    assert!(!active_rules.is_empty());
}