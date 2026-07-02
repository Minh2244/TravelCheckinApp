-- AI Manager Bot support tables.
-- Run this after the base AI User tables exist:
-- ai_conversations, ai_chat_history, ai_assistant_feedback.

CREATE TABLE IF NOT EXISTS ai_action_runs (
  action_run_id BIGINT NOT NULL AUTO_INCREMENT,
  command_id VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  conversation_id BIGINT DEFAULT NULL,
  history_id INT DEFAULT NULL,
  actor_user_id INT NOT NULL,
  assistant_scope ENUM('owner','admin') NOT NULL,
  role_at_time ENUM('owner','admin') NOT NULL,
  route VARCHAR(255) DEFAULT NULL,
  action_key VARCHAR(120) NOT NULL,
  risk_level ENUM('read','low','medium','high','critical','blocked') NOT NULL DEFAULT 'read',
  status ENUM(
    'parsed','needs_clarification','awaiting_confirmation',
    'executing','succeeded','failed','expired','cancelled','blocked'
  ) NOT NULL DEFAULT 'parsed',
  request_json JSON DEFAULT NULL,
  action_plan_json JSON DEFAULT NULL,
  preview_json JSON DEFAULT NULL,
  result_json JSON DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  prompt_version VARCHAR(50) DEFAULT NULL,
  model_version VARCHAR(80) DEFAULT NULL,
  confirmed_at DATETIME DEFAULT NULL,
  executed_at DATETIME DEFAULT NULL,
  expires_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (action_run_id),
  UNIQUE KEY uniq_ai_command_id (command_id),
  UNIQUE KEY uniq_ai_action_idempotency (idempotency_key),
  KEY idx_ai_action_actor_time (actor_user_id, created_at),
  KEY idx_ai_action_scope_status (assistant_scope, status, created_at),
  KEY idx_ai_action_expires (expires_at, status),
  CONSTRAINT fk_ai_action_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_action_conversation
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations(conversation_id) ON DELETE SET NULL,
  CONSTRAINT fk_ai_action_history
    FOREIGN KEY (history_id) REFERENCES ai_chat_history(history_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_action_policies (
  policy_id BIGINT NOT NULL AUTO_INCREMENT,
  assistant_scope ENUM('owner','admin') NOT NULL,
  action_key VARCHAR(120) NOT NULL,
  allowed_roles_json JSON NOT NULL,
  risk_level ENUM('read','low','medium','high','critical','blocked') NOT NULL DEFAULT 'read',
  requires_confirmation TINYINT(1) NOT NULL DEFAULT 0,
  route_allowlist_json JSON DEFAULT NULL,
  route_blocklist_json JSON DEFAULT NULL,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (policy_id),
  UNIQUE KEY uniq_ai_policy_action_scope (assistant_scope, action_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  prompt_version_id BIGINT NOT NULL AUTO_INCREMENT,
  assistant_scope ENUM('user','owner','admin') NOT NULL,
  version_code VARCHAR(80) NOT NULL,
  prompt_name VARCHAR(120) NOT NULL,
  prompt_text MEDIUMTEXT NOT NULL,
  status ENUM('draft','active','archived') NOT NULL DEFAULT 'draft',
  created_by INT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at DATETIME DEFAULT NULL,
  PRIMARY KEY (prompt_version_id),
  UNIQUE KEY uniq_ai_prompt_version (assistant_scope, version_code),
  KEY idx_ai_prompt_scope_status (assistant_scope, status),
  CONSTRAINT fk_ai_prompt_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_training_examples (
  example_id BIGINT NOT NULL AUTO_INCREMENT,
  assistant_scope ENUM('owner','admin') NOT NULL,
  source ENUM('seed','synthetic','chat_feedback','manual','evaluation') NOT NULL DEFAULT 'seed',
  role_label ENUM('owner','admin') NOT NULL,
  input_text TEXT NOT NULL,
  normalized_text TEXT DEFAULT NULL,
  expected_intent VARCHAR(120) NOT NULL,
  expected_label VARCHAR(120) NOT NULL,
  expected_action_key VARCHAR(120) DEFAULT NULL,
  expected_risk_level ENUM('read','low','medium','high','critical','blocked') DEFAULT NULL,
  route VARCHAR(255) DEFAULT NULL,
  context_json JSON DEFAULT NULL,
  quality_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (example_id),
  KEY idx_ai_training_scope_intent (assistant_scope, expected_intent),
  KEY idx_ai_training_quality (quality_status, created_at),
  CONSTRAINT fk_ai_training_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_model_versions (
  model_version_id BIGINT NOT NULL AUTO_INCREMENT,
  assistant_scope ENUM('owner','admin') NOT NULL,
  version_code VARCHAR(80) NOT NULL,
  model_type VARCHAR(80) NOT NULL,
  artifact_path VARCHAR(500) NOT NULL,
  train_dataset_path VARCHAR(500) DEFAULT NULL,
  metrics_json JSON DEFAULT NULL,
  label_map_json JSON DEFAULT NULL,
  status ENUM('training','candidate','active','archived','failed') NOT NULL DEFAULT 'candidate',
  trained_by INT DEFAULT NULL,
  trained_at DATETIME DEFAULT NULL,
  activated_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (model_version_id),
  UNIQUE KEY uniq_ai_model_version (assistant_scope, version_code),
  KEY idx_ai_model_scope_status (assistant_scope, status),
  CONSTRAINT fk_ai_model_trained_by
    FOREIGN KEY (trained_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_prompt_suggestions (
  suggestion_id VARCHAR(120) NOT NULL,
  assistant_scope ENUM('user','owner','admin') NOT NULL,
  surface VARCHAR(80) NOT NULL,
  route_pattern VARCHAR(255) DEFAULT NULL,
  title VARCHAR(160) NOT NULL,
  prompt TEXT NOT NULL,
  intent_hint VARCHAR(120) DEFAULT NULL,
  risk_level ENUM('read','low','medium','high','critical','blocked') NOT NULL DEFAULT 'read',
  allowed_roles_json JSON DEFAULT NULL,
  hidden_after_click TINYINT(1) NOT NULL DEFAULT 1,
  cooldown_seconds INT NOT NULL DEFAULT 86400,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (suggestion_id),
  KEY idx_ai_suggestion_scope_surface (assistant_scope, surface, status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_prompt_impressions (
  impression_id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  assistant_scope ENUM('user','owner','admin') NOT NULL,
  surface VARCHAR(80) NOT NULL,
  suggestion_group_id VARCHAR(120) DEFAULT NULL,
  suggestion_id VARCHAR(120) NOT NULL,
  conversation_id BIGINT DEFAULT NULL,
  status ENUM('shown','clicked','dismissed','expired') NOT NULL DEFAULT 'shown',
  shown_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clicked_at DATETIME DEFAULT NULL,
  dismissed_at DATETIME DEFAULT NULL,
  hidden_until DATETIME DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  PRIMARY KEY (impression_id),
  KEY idx_ai_prompt_impression_user_surface (user_id, assistant_scope, surface, status, hidden_until),
  KEY idx_ai_prompt_impression_suggestion (suggestion_id, status),
  CONSTRAINT fk_ai_prompt_impression_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_prompt_impression_conversation
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations(conversation_id) ON DELETE SET NULL,
  CONSTRAINT fk_ai_prompt_impression_suggestion
    FOREIGN KEY (suggestion_id) REFERENCES ai_prompt_suggestions(suggestion_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
