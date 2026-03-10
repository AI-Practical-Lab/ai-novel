/*
 Navicat Premium Data Transfer

 Source Server         : 105-3306
 Source Server Type    : MySQL
 Source Server Version : 80020
 Source Host           : 192.168.2.105:3306
 Source Schema         : ai-novel

 Target Server Type    : MySQL
 Target Server Version : 80020
 File Encoding         : 65001

 Date: 09/03/2026 11:58:40
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for novel_ai_usage_log
-- ----------------------------
DROP TABLE IF EXISTS `novel_ai_usage_log`;
CREATE TABLE `novel_ai_usage_log`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
  `project_id` bigint NULL DEFAULT NULL COMMENT '项目编号',
  `operation` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '操作',
  `platform` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '平台',
  `model` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '模型',
  `prompt_tokens` int NULL DEFAULT NULL COMMENT '输入tokens',
  `completion_tokens` int NULL DEFAULT NULL COMMENT '输出tokens',
  `total_tokens` int NULL DEFAULT NULL COMMENT '总tokens',
  `input_chars` int NULL DEFAULT NULL COMMENT '输入字符数',
  `output_chars` int NULL DEFAULT NULL COMMENT '输出字符数',
  `success` bit(1) NOT NULL DEFAULT b'1' COMMENT '是否成功',
  `error` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '错误信息',
  `extra` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '扩展JSON',
  `creator` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '创建者',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '更新者',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bit(1) NOT NULL DEFAULT b'0' COMMENT '是否删除',
  `tenant_id` bigint NOT NULL DEFAULT 0 COMMENT '租户编号',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_novel_ai_usage_op`(`operation` ASC) USING BTREE,
  INDEX `idx_novel_ai_usage_creator_time`(`creator` ASC, `create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 415 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'AI 使用记录' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for novel_chapter
-- ----------------------------
DROP TABLE IF EXISTS `novel_chapter`;
CREATE TABLE `novel_chapter`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
  `project_id` bigint NOT NULL COMMENT '项目编号',
  `volume_id` bigint NOT NULL COMMENT '分卷编号',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '章节标题',
  `summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '章节摘要',
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '章节正文',
  `beat_sheet` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '细纲JSON',
  `character_ids` varchar(2000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '角色ID列表，逗号分隔',
  `order_index` int NOT NULL DEFAULT 0 COMMENT '排序',
  `creator` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '创建者',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '更新者',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bit(1) NOT NULL DEFAULT b'0' COMMENT '是否删除',
  `tenant_id` bigint NOT NULL DEFAULT 0 COMMENT '租户编号',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_novel_chapter_project`(`project_id` ASC) USING BTREE,
  INDEX `idx_novel_chapter_volume`(`volume_id` ASC) USING BTREE,
  INDEX `idx_novel_chapter_order`(`order_index` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 887 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '小说章节' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for novel_character_knowledge
-- ----------------------------
DROP TABLE IF EXISTS `novel_character_knowledge`;
CREATE TABLE `novel_character_knowledge`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
  `project_id` bigint NOT NULL COMMENT '项目编号',
  `chapter_id` bigint NULL DEFAULT NULL COMMENT '章节编号（允许为NULL表示初始认知）',
  `character_lore_id` bigint NOT NULL COMMENT '人物设定ID（novel_lore.id）',
  `known_facts` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '已知事实',
  `misunderstandings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '误解/错误认知',
  `suspicions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '怀疑/预感',
  `extra` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '扩展JSON',
  `creator` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '创建者',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '更新者',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bit(1) NOT NULL DEFAULT b'0' COMMENT '是否删除',
  `tenant_id` bigint NOT NULL DEFAULT 0 COMMENT '租户编号',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uniq_character_knowledge`(`project_id` ASC, `chapter_id` ASC, `character_lore_id` ASC) USING BTREE,
  INDEX `idx_character_knowledge_proj_chapter`(`project_id` ASC, `chapter_id` ASC) USING BTREE,
  INDEX `idx_character_knowledge_proj_lore`(`project_id` ASC, `character_lore_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 22 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '角色认知快照' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for novel_foreshadowing
-- ----------------------------
DROP TABLE IF EXISTS `novel_foreshadowing`;
CREATE TABLE `novel_foreshadowing`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
  `project_id` bigint NOT NULL COMMENT '项目编号',
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '伏笔内容',
  `chapter_id` bigint NULL DEFAULT NULL COMMENT '出现章节ID',
  `chapter_title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '出现章节标题',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '状态',
  `visibility` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'author_only' COMMENT '可见性：author_only/reader_known/character_known',
  `character_id` bigint NULL DEFAULT NULL COMMENT '绑定角色ID（novel_lore.id），用于“角色知道但读者不知道”的秘密',
  `resolved_chapter_id` bigint NULL DEFAULT NULL COMMENT '兑现章节ID',
  `resolved_chapter_title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '兑现章节标题',
  `type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'long_term' COMMENT '类型',
  `creator` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '创建者',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '更新者',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bit(1) NOT NULL DEFAULT b'0' COMMENT '是否删除',
  `tenant_id` bigint NOT NULL DEFAULT 0 COMMENT '租户编号',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_novel_foreshadow_project`(`project_id` ASC) USING BTREE,
  INDEX `idx_novel_foreshadow_visibility`(`visibility` ASC) USING BTREE,
  INDEX `idx_novel_foreshadow_character`(`character_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 33 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '伏笔' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for novel_lore
-- ----------------------------
DROP TABLE IF EXISTS `novel_lore`;
CREATE TABLE `novel_lore`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
  `project_id` bigint NOT NULL COMMENT '项目编号',
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'other' COMMENT '类型',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '标题',
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '内容',
  `extra` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '扩展JSON',
  `creator` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '创建者',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '更新者',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bit(1) NOT NULL DEFAULT b'0' COMMENT '是否删除',
  `tenant_id` bigint NOT NULL DEFAULT 0 COMMENT '租户编号',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_novel_lore_project`(`project_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 235 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '设定项' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for novel_project
-- ----------------------------
DROP TABLE IF EXISTS `novel_project`;
CREATE TABLE `novel_project`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '标题',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '简介',
  `cover` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '封面',
  `author` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '作者',
  `genre` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '题材',
  `style` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '文风',
  `tags` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '标签JSON',
  `creator` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '创建者',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '更新者',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bit(1) NOT NULL DEFAULT b'0' COMMENT '是否删除',
  `tenant_id` bigint NOT NULL DEFAULT 0 COMMENT '租户编号',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 28 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '小说项目' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for novel_relations
-- ----------------------------
DROP TABLE IF EXISTS `novel_relations`;
CREATE TABLE `novel_relations`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
  `project_id` bigint NOT NULL COMMENT '项目编号',
  `edges` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '关系边JSON',
  `positions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '位置JSON',
  `creator` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '创建者',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '更新者',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bit(1) NOT NULL DEFAULT b'0' COMMENT '是否删除',
  `tenant_id` bigint NOT NULL DEFAULT 0 COMMENT '租户编号',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_novel_relations_project`(`project_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '关系图' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for novel_volume
-- ----------------------------
DROP TABLE IF EXISTS `novel_volume`;
CREATE TABLE `novel_volume`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
  `project_id` bigint NOT NULL COMMENT '项目编号',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '分卷标题',
  `summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '分卷摘要',
  `order_index` int NOT NULL DEFAULT 0 COMMENT '排序',
  `creator` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '创建者',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '更新者',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bit(1) NOT NULL DEFAULT b'0' COMMENT '是否删除',
  `tenant_id` bigint NOT NULL DEFAULT 0 COMMENT '租户编号',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_novel_volume_project`(`project_id` ASC) USING BTREE,
  INDEX `idx_novel_volume_order`(`order_index` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 71 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '小说分卷' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for novel_volume_milestones
-- ----------------------------
DROP TABLE IF EXISTS `novel_volume_milestones`;
CREATE TABLE `novel_volume_milestones`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
  `project_id` bigint NOT NULL COMMENT '项目编号',
  `volume_id` bigint NOT NULL COMMENT '分卷编号',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '路标标题',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '路标描述',
  `type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '路标类型：milestone/bridge等',
  `pace_type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '节奏类型：开篇/铺垫/过渡/高潮/收束',
  `cool_points` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '爽点列表(JSON数组)',
  `reversals` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '反转事件(JSON数组)',
  `foreshadows` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '伏笔信息(JSON数组)',
  `character_ids` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '出场角色ID列表(JSON数组)',
  `start_chapter_id` bigint NULL DEFAULT NULL COMMENT '起始章节ID',
  `end_chapter_id` bigint NULL DEFAULT NULL COMMENT '结束章节ID',
  `estimated_chapters` int NULL DEFAULT NULL COMMENT '预计章节数',
  `order_index` int NOT NULL DEFAULT 0 COMMENT '排序',
  `enabled` bit(1) NOT NULL DEFAULT b'1' COMMENT '是否启用',
  `creator` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '创建者',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '更新者',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bit(1) NOT NULL DEFAULT b'0' COMMENT '是否删除',
  `tenant_id` bigint NOT NULL DEFAULT 0 COMMENT '租户编号',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_milestone_project`(`project_id` ASC) USING BTREE,
  INDEX `fk_milestone_volume`(`volume_id` ASC) USING BTREE,
  INDEX `fk_milestone_start_chapter`(`start_chapter_id` ASC) USING BTREE,
  INDEX `fk_milestone_end_chapter`(`end_chapter_id` ASC) USING BTREE,
  CONSTRAINT `fk_milestone_end_chapter` FOREIGN KEY (`end_chapter_id`) REFERENCES `novel_chapter` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_milestone_project` FOREIGN KEY (`project_id`) REFERENCES `novel_project` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_milestone_start_chapter` FOREIGN KEY (`start_chapter_id`) REFERENCES `novel_chapter` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_milestone_volume` FOREIGN KEY (`volume_id`) REFERENCES `novel_volume` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 121 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '分卷路标' ROW_FORMAT = DYNAMIC;

SET FOREIGN_KEY_CHECKS = 1;
