-- 知识库平台 LLM 配置表（T19）
-- 权威副本见 moli-project-distribute/docs/sql/11_kb_platform_llm_config.sql
-- 部署前在 knowledge 库执行；与 12_kb_platform_llm_menu.sql 配套

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `kb_platform_llm_config` (
  `id` bigint NOT NULL COMMENT '固定 1（平台单例）',
  `create_id` bigint DEFAULT NULL COMMENT '创建人',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_id` bigint DEFAULT NULL COMMENT '修改人',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `enabled` tinyint NOT NULL DEFAULT 0 COMMENT '1启用 0停用',
  `provider` varchar(32) NOT NULL DEFAULT 'deepseek' COMMENT 'deepseek/qwen/glm/custom',
  `base_url` varchar(512) NOT NULL DEFAULT 'https://api.deepseek.com/v1' COMMENT 'OpenAI 兼容 base-url',
  `api_key_cipher` varchar(1024) DEFAULT NULL COMMENT 'AES-GCM 密文 Base64',
  `api_key_mask` varchar(32) DEFAULT NULL COMMENT '脱敏展示 ****末4位',
  `model` varchar(128) NOT NULL DEFAULT 'deepseek-chat' COMMENT '默认模型',
  `temperature` decimal(4,2) NOT NULL DEFAULT 0.30 COMMENT '采样温度',
  `timeout_seconds` int NOT NULL DEFAULT 90 COMMENT 'HTTP 超时秒',
  `extra_models` json DEFAULT NULL COMMENT '治理/Ingest 可选模型列表 JSON 数组',
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_kb_platform_llm_singleton` CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库平台 LLM 配置（Web 系统设置）';

INSERT INTO `kb_platform_llm_config` (`id`, `enabled`, `provider`, `base_url`, `model`, `temperature`, `timeout_seconds`, `create_time`, `update_time`)
VALUES (1, 0, 'deepseek', 'https://api.deepseek.com/v1', 'deepseek-chat', 0.30, 90, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time` = `update_time`;
