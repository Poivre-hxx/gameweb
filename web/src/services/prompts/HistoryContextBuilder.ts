/**
 * History Context Builder
 * Responsible for formatting version iteration chains into AI-understandable history context
 */

import type { GameVersion } from '../../types';
import type { VersionHistoryContextInput, GameAssistantSystemPrompt } from './types';

export class HistoryContextBuilder {
  /**
   * Build history context prompt
   * Convert iteration chain into structured history description
   */
  buildHistoryContext(input: VersionHistoryContextInput): string {
    const { versions, currentVersionId } = input;

    if (!versions || versions.length === 0) {
      return this.buildEmptyHistoryContext();
    }

    const sections: string[] = [];

    // 1. Overview section
    sections.push(this.buildOverviewSection(versions, currentVersionId));

    // 2. Initial version (root node)
    sections.push(this.buildInitialVersionSection(versions[0]));

    // 3. Iteration history (excluding root node)
    if (versions.length > 1) {
      sections.push(this.buildIterationHistorySection(versions.slice(1)));
    }

    // 4. Current state summary
    sections.push(this.buildCurrentStateSection(versions[versions.length - 1]));

    return sections.join('\n\n---\n\n');
  }

  /**
   * 构建完整的游戏助手系统提示词
   */
  buildGameAssistantPrompt(historyContext: string): GameAssistantSystemPrompt {
    return `# AI Game Design Assistant

You are a professional game design assistant helping users improve their 2D platformer games.
Your goal is not only to provide design suggestions, but also to help users understand the current design state and gradually refine their game design.

# Your Capabilities
You can help users with the following design tasks:

1. Level Design
Help users analyze and improve the level structure, for example:
- Adjusting terrain layout
- Optimizing element placement

2. Rule Design
You can suggest adding or modifying basic game rules, such as:
- Whether the character can jump or shoot
- Whether there are collectibles or objectives
- Basic interaction rules between the character and enemies
You cannot adjust specific numerical parameters. You may only provide rule-level design suggestions.

3. Game Design Analysis
You can analyze the overall design state of the current game, including:
- Analyzing the development progress of the current game version
- Evaluating the overall completion level of the game
- Summarizing the core gameplay that already exists in the current design
- Identifying important missing gameplay elements
These analyses help you understand the current design and provide a basis for further suggestions or questions.

# Heuristic Guidance Strategy
When helping users design their game, you should act as both a design assistant and a thinking guide, rather than simply providing direct conclusions.
Before giving suggestions, you may first help the user understand the current design through analysis and questions.

1. Socratic Questioning
Guide the user’s thinking through questions, for example:
- Is this the first time the player encounters an enemy here?
- Does the current map contain a clear traversable path?
These questions should help the user actively discover design problems or new design opportunities.

2. User Understanding Tracking
During the conversation, infer the user’s level of understanding of the current game design based on their responses, for example:
- whether the user understands the current gameplay structure
- Whether the user is aware of potential design issues
- Whether the user knows how the design could be improved next
Adjust your guidance according to the user's level of understanding:
- If the user seems uncertain → provide hints or simpler questions
- If the user shows a good understanding → guide deeper design discussions

3. Design Idea Validation
When the user proposes a new design idea, help evaluate its potential effects, for example:
- Will this change improve the player experience?
- Will players easily understand the new gameplay?
- Could this change introduce new problems?

# Current Game History

${historyContext}

Please respond to users in English.` as GameAssistantSystemPrompt;
  }

  // ========== Private Helper Methods ==========

  private buildEmptyHistoryContext(): string {
    return `### Game State

No saved game versions yet. Please create a game prototype first.`;
  }

  private buildOverviewSection(versions: GameVersion[], currentVersionId: string): string {
    const currentIndex = versions.findIndex(v => v.id === currentVersionId);
    const iterationCount = versions.length - 1; // Exclude root version
    const isLatest = currentIndex === versions.length - 1;

    return `### Game Overview

- **Total Versions**: ${versions.length} versions
- **Iterations**: ${iterationCount} iterations
- **Current Position**: Version ${currentIndex + 1}${isLatest ? ' (latest)' : ' (viewing historical version)'}`;
  }

  private buildInitialVersionSection(rootVersion: GameVersion): string {
    const timestamp = this.formatTimestamp(rootVersion.timestamp);
    const gameDescription = rootVersion.metadata?.gameDescription ||
                           this.extractDescriptionFromCaption(rootVersion.caption);

    let section = `### Initial Version (v1)

**Created**: ${timestamp}

**Game Description**:
${gameDescription}

**Game Configuration**:
${this.formatGameConfig(rootVersion.code?.gameConfig)}`;

    // If detailed rules exist, add rules summary
    if (rootVersion.metadata?.detailedRules) {
      section += `\n\n**Core Rules Summary**:
${this.summarizeRules(rootVersion.metadata.detailedRules)}`;
    }

    return section;
  }

  private buildIterationHistorySection(iterations: GameVersion[]): string {
    if (iterations.length === 0) {
      return '';
    }

    const items = iterations.map((version, index) => {
      return this.formatIterationItem(version, index + 2); // +2 because root version is v1
    });

    return `### Iteration History

${items.join('\n\n')}`;
  }

  private formatIterationItem(version: GameVersion, versionNumber: number): string {
    const timestamp = this.formatTimestamp(version.timestamp);
    const feedback = version.feedbackText || '(No feedback recorded)';

    let item = `#### Version ${versionNumber} (Iteration ${version.iterationCount || versionNumber - 1})

**Time**: ${timestamp}
**Feedback**: ${feedback}`;

    // Add update decision information
    if (version.metadata?.updateDecision) {
      const decision = version.metadata.updateDecision;
      item += `\n**Changes**: ${decision.reasoning || '(No description)'}`;
      item += `\n- Updated Code: ${decision.updateCode ? 'Yes' : 'No'}`;
      item += `\n- Updated Map: ${decision.updateMap ? 'Yes' : 'No'}`;
    }

    return item;
  }

  private buildCurrentStateSection(currentVersion: GameVersion): string {
    const terrainGrid = currentVersion.mapData?.terrain?.grid;
    const mapWidth = terrainGrid?.[0]?.row?.length || 0;
    const mapHeight = terrainGrid?.length || 0;
    const entityTypes = Object.keys(currentVersion.schema?.mapping || {}).length;

    return `### Current State Summary

**Map Size**: ${mapWidth} x ${mapHeight} tiles
**Entity Types**: ${entityTypes} types

**Current Game Mode**:
${this.formatGameConfig(currentVersion.code?.gameConfig)}

**Available Entities**:
${this.formatEntityList(currentVersion.schema?.mapping)}`;
  }

  // ========== Formatting Helper Methods ==========

  private formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private extractDescriptionFromCaption(caption: string): string {
    // If caption is long, extract first 200 characters as description
    if (caption.length > 200) {
      return caption.substring(0, 200) + '...';
    }
    return caption;
  }

  private formatGameConfig(config?: any): string {
    if (!config) return '- (No configuration)';

    const lines: string[] = [];
    if (config.physicsMode) {
      const modeMap: Record<string, string> = {
        'platformer': 'Platformer',
        'topdown': 'Top-down',
        'freely': 'Free Movement'
      };
      lines.push(`- Physics Mode: ${modeMap[config.physicsMode] || config.physicsMode}`);
    }
    if (config.cameraMode) {
      const cameraMap: Record<string, string> = {
        'fixed': 'Fixed Camera',
        'follow': 'Follow Player',
        'auto-scroll': 'Auto-scroll'
      };
      lines.push(`- Camera: ${cameraMap[config.cameraMode] || config.cameraMode}`);
    }
    return lines.join('\n') || '- (No configuration)';
  }

  private summarizeRules(rules: string): string {
    // Simple truncation of rules to first 500 characters as summary
    if (!rules) return '(No rules)';
    if (rules.length <= 500) return rules;
    return rules.substring(0, 500) + '...\n\n(Rules truncated for brevity)';
  }

  private formatEntityList(mapping?: Record<string, any>): string {
    if (!mapping) return '(No entities defined)';

    const entities = Object.entries(mapping)
      .map(([key, info]: [string, any]) => {
        const name = info.name || key;
        const category = info.category || 'unknown';
        return `- **${name}** (${category})`;
      })
      .slice(0, 15); // Limit display count

    let result = entities.join('\n');
    if (Object.keys(mapping).length > 15) {
      result += `\n- ... and ${Object.keys(mapping).length - 15} more entity types`;
    }
    return result;
  }
}
