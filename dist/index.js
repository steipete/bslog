#!/usr/bin/env bun
// @bun
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/commander/lib/error.js
var require_error = __commonJS((exports) => {
  class CommanderError extends Error {
    constructor(exitCode, code, message) {
      super(message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.code = code;
      this.exitCode = exitCode;
      this.nestedError = undefined;
    }
  }

  class InvalidArgumentError extends CommanderError {
    constructor(message) {
      super(1, "commander.invalidArgument", message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
    }
  }
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
});

// node_modules/commander/lib/argument.js
var require_argument = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Argument {
    constructor(name, description) {
      this.description = description || "";
      this.variadic = false;
      this.parseArg = undefined;
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.argChoices = undefined;
      switch (name[0]) {
        case "<":
          this.required = true;
          this._name = name.slice(1, -1);
          break;
        case "[":
          this.required = false;
          this._name = name.slice(1, -1);
          break;
        default:
          this.required = true;
          this._name = name;
          break;
      }
      if (this._name.endsWith("...")) {
        this.variadic = true;
        this._name = this._name.slice(0, -3);
      }
    }
    name() {
      return this._name;
    }
    _collectValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      previous.push(value);
      return previous;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._collectValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    argRequired() {
      this.required = true;
      return this;
    }
    argOptional() {
      this.required = false;
      return this;
    }
  }
  function humanReadableArgName(arg) {
    const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
    return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
  }
  exports.Argument = Argument;
  exports.humanReadableArgName = humanReadableArgName;
});

// node_modules/commander/lib/help.js
var require_help = __commonJS((exports) => {
  var { humanReadableArgName } = require_argument();

  class Help {
    constructor() {
      this.helpWidth = undefined;
      this.minWidthToWrap = 40;
      this.sortSubcommands = false;
      this.sortOptions = false;
      this.showGlobalOptions = false;
    }
    prepareContext(contextOptions) {
      this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
    }
    visibleCommands(cmd) {
      const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
      const helpCommand = cmd._getHelpCommand();
      if (helpCommand && !helpCommand._hidden) {
        visibleCommands.push(helpCommand);
      }
      if (this.sortSubcommands) {
        visibleCommands.sort((a, b) => {
          return a.name().localeCompare(b.name());
        });
      }
      return visibleCommands;
    }
    compareOptions(a, b) {
      const getSortKey = (option) => {
        return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
      };
      return getSortKey(a).localeCompare(getSortKey(b));
    }
    visibleOptions(cmd) {
      const visibleOptions = cmd.options.filter((option) => !option.hidden);
      const helpOption = cmd._getHelpOption();
      if (helpOption && !helpOption.hidden) {
        const removeShort = helpOption.short && cmd._findOption(helpOption.short);
        const removeLong = helpOption.long && cmd._findOption(helpOption.long);
        if (!removeShort && !removeLong) {
          visibleOptions.push(helpOption);
        } else if (helpOption.long && !removeLong) {
          visibleOptions.push(cmd.createOption(helpOption.long, helpOption.description));
        } else if (helpOption.short && !removeShort) {
          visibleOptions.push(cmd.createOption(helpOption.short, helpOption.description));
        }
      }
      if (this.sortOptions) {
        visibleOptions.sort(this.compareOptions);
      }
      return visibleOptions;
    }
    visibleGlobalOptions(cmd) {
      if (!this.showGlobalOptions)
        return [];
      const globalOptions = [];
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        const visibleOptions = ancestorCmd.options.filter((option) => !option.hidden);
        globalOptions.push(...visibleOptions);
      }
      if (this.sortOptions) {
        globalOptions.sort(this.compareOptions);
      }
      return globalOptions;
    }
    visibleArguments(cmd) {
      if (cmd._argsDescription) {
        cmd.registeredArguments.forEach((argument) => {
          argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
        });
      }
      if (cmd.registeredArguments.find((argument) => argument.description)) {
        return cmd.registeredArguments;
      }
      return [];
    }
    subcommandTerm(cmd) {
      const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
      return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + (args ? " " + args : "");
    }
    optionTerm(option) {
      return option.flags;
    }
    argumentTerm(argument) {
      return argument.name();
    }
    longestSubcommandTermLength(cmd, helper) {
      return helper.visibleCommands(cmd).reduce((max, command) => {
        return Math.max(max, this.displayWidth(helper.styleSubcommandTerm(helper.subcommandTerm(command))));
      }, 0);
    }
    longestOptionTermLength(cmd, helper) {
      return helper.visibleOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestGlobalOptionTermLength(cmd, helper) {
      return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestArgumentTermLength(cmd, helper) {
      return helper.visibleArguments(cmd).reduce((max, argument) => {
        return Math.max(max, this.displayWidth(helper.styleArgumentTerm(helper.argumentTerm(argument))));
      }, 0);
    }
    commandUsage(cmd) {
      let cmdName = cmd._name;
      if (cmd._aliases[0]) {
        cmdName = cmdName + "|" + cmd._aliases[0];
      }
      let ancestorCmdNames = "";
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
      }
      return ancestorCmdNames + cmdName + " " + cmd.usage();
    }
    commandDescription(cmd) {
      return cmd.description();
    }
    subcommandDescription(cmd) {
      return cmd.summary() || cmd.description();
    }
    optionDescription(option) {
      const extraInfo = [];
      if (option.argChoices) {
        extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (option.defaultValue !== undefined) {
        const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
        if (showDefault) {
          extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
        }
      }
      if (option.presetArg !== undefined && option.optional) {
        extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
      }
      if (option.envVar !== undefined) {
        extraInfo.push(`env: ${option.envVar}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (option.description) {
          return `${option.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return option.description;
    }
    argumentDescription(argument) {
      const extraInfo = [];
      if (argument.argChoices) {
        extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (argument.defaultValue !== undefined) {
        extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (argument.description) {
          return `${argument.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return argument.description;
    }
    formatItemList(heading, items, helper) {
      if (items.length === 0)
        return [];
      return [helper.styleTitle(heading), ...items, ""];
    }
    groupItems(unsortedItems, visibleItems, getGroup) {
      const result = new Map;
      unsortedItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group))
          result.set(group, []);
      });
      visibleItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group)) {
          result.set(group, []);
        }
        result.get(group).push(item);
      });
      return result;
    }
    formatHelp(cmd, helper) {
      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth = helper.helpWidth ?? 80;
      function callFormatItem(term, description) {
        return helper.formatItem(term, termWidth, description, helper);
      }
      let output = [
        `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
        ""
      ];
      const commandDescription = helper.commandDescription(cmd);
      if (commandDescription.length > 0) {
        output = output.concat([
          helper.boxWrap(helper.styleCommandDescription(commandDescription), helpWidth),
          ""
        ]);
      }
      const argumentList = helper.visibleArguments(cmd).map((argument) => {
        return callFormatItem(helper.styleArgumentTerm(helper.argumentTerm(argument)), helper.styleArgumentDescription(helper.argumentDescription(argument)));
      });
      output = output.concat(this.formatItemList("Arguments:", argumentList, helper));
      const optionGroups = this.groupItems(cmd.options, helper.visibleOptions(cmd), (option) => option.helpGroupHeading ?? "Options:");
      optionGroups.forEach((options, group) => {
        const optionList = options.map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        output = output.concat(this.formatItemList(group, optionList, helper));
      });
      if (helper.showGlobalOptions) {
        const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        output = output.concat(this.formatItemList("Global Options:", globalOptionList, helper));
      }
      const commandGroups = this.groupItems(cmd.commands, helper.visibleCommands(cmd), (sub) => sub.helpGroup() || "Commands:");
      commandGroups.forEach((commands, group) => {
        const commandList = commands.map((sub) => {
          return callFormatItem(helper.styleSubcommandTerm(helper.subcommandTerm(sub)), helper.styleSubcommandDescription(helper.subcommandDescription(sub)));
        });
        output = output.concat(this.formatItemList(group, commandList, helper));
      });
      return output.join(`
`);
    }
    displayWidth(str) {
      return stripColor(str).length;
    }
    styleTitle(str) {
      return str;
    }
    styleUsage(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word === "[command]")
          return this.styleSubcommandText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleCommandText(word);
      }).join(" ");
    }
    styleCommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleOptionDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleSubcommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleArgumentDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleDescriptionText(str) {
      return str;
    }
    styleOptionTerm(str) {
      return this.styleOptionText(str);
    }
    styleSubcommandTerm(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleSubcommandText(word);
      }).join(" ");
    }
    styleArgumentTerm(str) {
      return this.styleArgumentText(str);
    }
    styleOptionText(str) {
      return str;
    }
    styleArgumentText(str) {
      return str;
    }
    styleSubcommandText(str) {
      return str;
    }
    styleCommandText(str) {
      return str;
    }
    padWidth(cmd, helper) {
      return Math.max(helper.longestOptionTermLength(cmd, helper), helper.longestGlobalOptionTermLength(cmd, helper), helper.longestSubcommandTermLength(cmd, helper), helper.longestArgumentTermLength(cmd, helper));
    }
    preformatted(str) {
      return /\n[^\S\r\n]/.test(str);
    }
    formatItem(term, termWidth, description, helper) {
      const itemIndent = 2;
      const itemIndentStr = " ".repeat(itemIndent);
      if (!description)
        return itemIndentStr + term;
      const paddedTerm = term.padEnd(termWidth + term.length - helper.displayWidth(term));
      const spacerWidth = 2;
      const helpWidth = this.helpWidth ?? 80;
      const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
      let formattedDescription;
      if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
        formattedDescription = description;
      } else {
        const wrappedDescription = helper.boxWrap(description, remainingWidth);
        formattedDescription = wrappedDescription.replace(/\n/g, `
` + " ".repeat(termWidth + spacerWidth));
      }
      return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
    }
    boxWrap(str, width) {
      if (width < this.minWidthToWrap)
        return str;
      const rawLines = str.split(/\r\n|\n/);
      const chunkPattern = /[\s]*[^\s]+/g;
      const wrappedLines = [];
      rawLines.forEach((line) => {
        const chunks = line.match(chunkPattern);
        if (chunks === null) {
          wrappedLines.push("");
          return;
        }
        let sumChunks = [chunks.shift()];
        let sumWidth = this.displayWidth(sumChunks[0]);
        chunks.forEach((chunk) => {
          const visibleWidth = this.displayWidth(chunk);
          if (sumWidth + visibleWidth <= width) {
            sumChunks.push(chunk);
            sumWidth += visibleWidth;
            return;
          }
          wrappedLines.push(sumChunks.join(""));
          const nextChunk = chunk.trimStart();
          sumChunks = [nextChunk];
          sumWidth = this.displayWidth(nextChunk);
        });
        wrappedLines.push(sumChunks.join(""));
      });
      return wrappedLines.join(`
`);
    }
  }
  function stripColor(str) {
    const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
    return str.replace(sgrPattern, "");
  }
  exports.Help = Help;
  exports.stripColor = stripColor;
});

// node_modules/commander/lib/option.js
var require_option = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Option {
    constructor(flags, description) {
      this.flags = flags;
      this.description = description || "";
      this.required = flags.includes("<");
      this.optional = flags.includes("[");
      this.variadic = /\w\.\.\.[>\]]$/.test(flags);
      this.mandatory = false;
      const optionFlags = splitOptionFlags(flags);
      this.short = optionFlags.shortFlag;
      this.long = optionFlags.longFlag;
      this.negate = false;
      if (this.long) {
        this.negate = this.long.startsWith("--no-");
      }
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.presetArg = undefined;
      this.envVar = undefined;
      this.parseArg = undefined;
      this.hidden = false;
      this.argChoices = undefined;
      this.conflictsWith = [];
      this.implied = undefined;
      this.helpGroupHeading = undefined;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    preset(arg) {
      this.presetArg = arg;
      return this;
    }
    conflicts(names) {
      this.conflictsWith = this.conflictsWith.concat(names);
      return this;
    }
    implies(impliedOptionValues) {
      let newImplied = impliedOptionValues;
      if (typeof impliedOptionValues === "string") {
        newImplied = { [impliedOptionValues]: true };
      }
      this.implied = Object.assign(this.implied || {}, newImplied);
      return this;
    }
    env(name) {
      this.envVar = name;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    makeOptionMandatory(mandatory = true) {
      this.mandatory = !!mandatory;
      return this;
    }
    hideHelp(hide = true) {
      this.hidden = !!hide;
      return this;
    }
    _collectValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      previous.push(value);
      return previous;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._collectValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    name() {
      if (this.long) {
        return this.long.replace(/^--/, "");
      }
      return this.short.replace(/^-/, "");
    }
    attributeName() {
      if (this.negate) {
        return camelcase(this.name().replace(/^no-/, ""));
      }
      return camelcase(this.name());
    }
    helpGroup(heading) {
      this.helpGroupHeading = heading;
      return this;
    }
    is(arg) {
      return this.short === arg || this.long === arg;
    }
    isBoolean() {
      return !this.required && !this.optional && !this.negate;
    }
  }

  class DualOptions {
    constructor(options) {
      this.positiveOptions = new Map;
      this.negativeOptions = new Map;
      this.dualOptions = new Set;
      options.forEach((option) => {
        if (option.negate) {
          this.negativeOptions.set(option.attributeName(), option);
        } else {
          this.positiveOptions.set(option.attributeName(), option);
        }
      });
      this.negativeOptions.forEach((value, key) => {
        if (this.positiveOptions.has(key)) {
          this.dualOptions.add(key);
        }
      });
    }
    valueFromOption(value, option) {
      const optionKey = option.attributeName();
      if (!this.dualOptions.has(optionKey))
        return true;
      const preset = this.negativeOptions.get(optionKey).presetArg;
      const negativeValue = preset !== undefined ? preset : false;
      return option.negate === (negativeValue === value);
    }
  }
  function camelcase(str) {
    return str.split("-").reduce((str2, word) => {
      return str2 + word[0].toUpperCase() + word.slice(1);
    });
  }
  function splitOptionFlags(flags) {
    let shortFlag;
    let longFlag;
    const shortFlagExp = /^-[^-]$/;
    const longFlagExp = /^--[^-]/;
    const flagParts = flags.split(/[ |,]+/).concat("guard");
    if (shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (longFlagExp.test(flagParts[0]))
      longFlag = flagParts.shift();
    if (!shortFlag && shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (!shortFlag && longFlagExp.test(flagParts[0])) {
      shortFlag = longFlag;
      longFlag = flagParts.shift();
    }
    if (flagParts[0].startsWith("-")) {
      const unsupportedFlag = flagParts[0];
      const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
      if (/^-[^-][^-]/.test(unsupportedFlag))
        throw new Error(`${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`);
      if (shortFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many short flags`);
      if (longFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many long flags`);
      throw new Error(`${baseError}
- unrecognised flag format`);
    }
    if (shortFlag === undefined && longFlag === undefined)
      throw new Error(`option creation failed due to no flags found in '${flags}'.`);
    return { shortFlag, longFlag };
  }
  exports.Option = Option;
  exports.DualOptions = DualOptions;
});

// node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS((exports) => {
  var maxDistance = 3;
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > maxDistance)
      return Math.max(a.length, b.length);
    const d = [];
    for (let i = 0;i <= a.length; i++) {
      d[i] = [i];
    }
    for (let j = 0;j <= b.length; j++) {
      d[0][j] = j;
    }
    for (let j = 1;j <= b.length; j++) {
      for (let i = 1;i <= a.length; i++) {
        let cost = 1;
        if (a[i - 1] === b[j - 1]) {
          cost = 0;
        } else {
          cost = 1;
        }
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }
  function suggestSimilar(word, candidates) {
    if (!candidates || candidates.length === 0)
      return "";
    candidates = Array.from(new Set(candidates));
    const searchingOptions = word.startsWith("--");
    if (searchingOptions) {
      word = word.slice(2);
      candidates = candidates.map((candidate) => candidate.slice(2));
    }
    let similar = [];
    let bestDistance = maxDistance;
    const minSimilarity = 0.4;
    candidates.forEach((candidate) => {
      if (candidate.length <= 1)
        return;
      const distance = editDistance(word, candidate);
      const length = Math.max(word.length, candidate.length);
      const similarity = (length - distance) / length;
      if (similarity > minSimilarity) {
        if (distance < bestDistance) {
          bestDistance = distance;
          similar = [candidate];
        } else if (distance === bestDistance) {
          similar.push(candidate);
        }
      }
    });
    similar.sort((a, b) => a.localeCompare(b));
    if (searchingOptions) {
      similar = similar.map((candidate) => `--${candidate}`);
    }
    if (similar.length > 1) {
      return `
(Did you mean one of ${similar.join(", ")}?)`;
    }
    if (similar.length === 1) {
      return `
(Did you mean ${similar[0]}?)`;
    }
    return "";
  }
  exports.suggestSimilar = suggestSimilar;
});

// node_modules/commander/lib/command.js
var require_command = __commonJS((exports) => {
  var EventEmitter = __require("node:events").EventEmitter;
  var childProcess = __require("node:child_process");
  var path = __require("node:path");
  var fs = __require("node:fs");
  var process3 = __require("node:process");
  var { Argument, humanReadableArgName } = require_argument();
  var { CommanderError } = require_error();
  var { Help, stripColor } = require_help();
  var { Option, DualOptions } = require_option();
  var { suggestSimilar } = require_suggestSimilar();

  class Command extends EventEmitter {
    constructor(name) {
      super();
      this.commands = [];
      this.options = [];
      this.parent = null;
      this._allowUnknownOption = false;
      this._allowExcessArguments = false;
      this.registeredArguments = [];
      this._args = this.registeredArguments;
      this.args = [];
      this.rawArgs = [];
      this.processedArgs = [];
      this._scriptPath = null;
      this._name = name || "";
      this._optionValues = {};
      this._optionValueSources = {};
      this._storeOptionsAsProperties = false;
      this._actionHandler = null;
      this._executableHandler = false;
      this._executableFile = null;
      this._executableDir = null;
      this._defaultCommandName = null;
      this._exitCallback = null;
      this._aliases = [];
      this._combineFlagAndOptionalValue = true;
      this._description = "";
      this._summary = "";
      this._argsDescription = undefined;
      this._enablePositionalOptions = false;
      this._passThroughOptions = false;
      this._lifeCycleHooks = {};
      this._showHelpAfterError = false;
      this._showSuggestionAfterError = true;
      this._savedState = null;
      this._outputConfiguration = {
        writeOut: (str) => process3.stdout.write(str),
        writeErr: (str) => process3.stderr.write(str),
        outputError: (str, write) => write(str),
        getOutHelpWidth: () => process3.stdout.isTTY ? process3.stdout.columns : undefined,
        getErrHelpWidth: () => process3.stderr.isTTY ? process3.stderr.columns : undefined,
        getOutHasColors: () => useColor() ?? (process3.stdout.isTTY && process3.stdout.hasColors?.()),
        getErrHasColors: () => useColor() ?? (process3.stderr.isTTY && process3.stderr.hasColors?.()),
        stripColor: (str) => stripColor(str)
      };
      this._hidden = false;
      this._helpOption = undefined;
      this._addImplicitHelpCommand = undefined;
      this._helpCommand = undefined;
      this._helpConfiguration = {};
      this._helpGroupHeading = undefined;
      this._defaultCommandGroup = undefined;
      this._defaultOptionGroup = undefined;
    }
    copyInheritedSettings(sourceCommand) {
      this._outputConfiguration = sourceCommand._outputConfiguration;
      this._helpOption = sourceCommand._helpOption;
      this._helpCommand = sourceCommand._helpCommand;
      this._helpConfiguration = sourceCommand._helpConfiguration;
      this._exitCallback = sourceCommand._exitCallback;
      this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
      this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
      this._allowExcessArguments = sourceCommand._allowExcessArguments;
      this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
      this._showHelpAfterError = sourceCommand._showHelpAfterError;
      this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
      return this;
    }
    _getCommandAndAncestors() {
      const result = [];
      for (let command = this;command; command = command.parent) {
        result.push(command);
      }
      return result;
    }
    command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
      let desc = actionOptsOrExecDesc;
      let opts = execOpts;
      if (typeof desc === "object" && desc !== null) {
        opts = desc;
        desc = null;
      }
      opts = opts || {};
      const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const cmd = this.createCommand(name);
      if (desc) {
        cmd.description(desc);
        cmd._executableHandler = true;
      }
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      cmd._hidden = !!(opts.noHelp || opts.hidden);
      cmd._executableFile = opts.executableFile || null;
      if (args)
        cmd.arguments(args);
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd.copyInheritedSettings(this);
      if (desc)
        return this;
      return cmd;
    }
    createCommand(name) {
      return new Command(name);
    }
    createHelp() {
      return Object.assign(new Help, this.configureHelp());
    }
    configureHelp(configuration) {
      if (configuration === undefined)
        return this._helpConfiguration;
      this._helpConfiguration = configuration;
      return this;
    }
    configureOutput(configuration) {
      if (configuration === undefined)
        return this._outputConfiguration;
      this._outputConfiguration = {
        ...this._outputConfiguration,
        ...configuration
      };
      return this;
    }
    showHelpAfterError(displayHelp = true) {
      if (typeof displayHelp !== "string")
        displayHelp = !!displayHelp;
      this._showHelpAfterError = displayHelp;
      return this;
    }
    showSuggestionAfterError(displaySuggestion = true) {
      this._showSuggestionAfterError = !!displaySuggestion;
      return this;
    }
    addCommand(cmd, opts) {
      if (!cmd._name) {
        throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
      }
      opts = opts || {};
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      if (opts.noHelp || opts.hidden)
        cmd._hidden = true;
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd._checkForBrokenPassThrough();
      return this;
    }
    createArgument(name, description) {
      return new Argument(name, description);
    }
    argument(name, description, parseArg, defaultValue) {
      const argument = this.createArgument(name, description);
      if (typeof parseArg === "function") {
        argument.default(defaultValue).argParser(parseArg);
      } else {
        argument.default(parseArg);
      }
      this.addArgument(argument);
      return this;
    }
    arguments(names) {
      names.trim().split(/ +/).forEach((detail) => {
        this.argument(detail);
      });
      return this;
    }
    addArgument(argument) {
      const previousArgument = this.registeredArguments.slice(-1)[0];
      if (previousArgument?.variadic) {
        throw new Error(`only the last argument can be variadic '${previousArgument.name()}'`);
      }
      if (argument.required && argument.defaultValue !== undefined && argument.parseArg === undefined) {
        throw new Error(`a default value for a required argument is never used: '${argument.name()}'`);
      }
      this.registeredArguments.push(argument);
      return this;
    }
    helpCommand(enableOrNameAndArgs, description) {
      if (typeof enableOrNameAndArgs === "boolean") {
        this._addImplicitHelpCommand = enableOrNameAndArgs;
        if (enableOrNameAndArgs && this._defaultCommandGroup) {
          this._initCommandGroup(this._getHelpCommand());
        }
        return this;
      }
      const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
      const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const helpDescription = description ?? "display help for command";
      const helpCommand = this.createCommand(helpName);
      helpCommand.helpOption(false);
      if (helpArgs)
        helpCommand.arguments(helpArgs);
      if (helpDescription)
        helpCommand.description(helpDescription);
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      if (enableOrNameAndArgs || description)
        this._initCommandGroup(helpCommand);
      return this;
    }
    addHelpCommand(helpCommand, deprecatedDescription) {
      if (typeof helpCommand !== "object") {
        this.helpCommand(helpCommand, deprecatedDescription);
        return this;
      }
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      this._initCommandGroup(helpCommand);
      return this;
    }
    _getHelpCommand() {
      const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
      if (hasImplicitHelpCommand) {
        if (this._helpCommand === undefined) {
          this.helpCommand(undefined, undefined);
        }
        return this._helpCommand;
      }
      return null;
    }
    hook(event, listener) {
      const allowedValues = ["preSubcommand", "preAction", "postAction"];
      if (!allowedValues.includes(event)) {
        throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      if (this._lifeCycleHooks[event]) {
        this._lifeCycleHooks[event].push(listener);
      } else {
        this._lifeCycleHooks[event] = [listener];
      }
      return this;
    }
    exitOverride(fn) {
      if (fn) {
        this._exitCallback = fn;
      } else {
        this._exitCallback = (err) => {
          if (err.code !== "commander.executeSubCommandAsync") {
            throw err;
          } else {}
        };
      }
      return this;
    }
    _exit(exitCode, code, message) {
      if (this._exitCallback) {
        this._exitCallback(new CommanderError(exitCode, code, message));
      }
      process3.exit(exitCode);
    }
    action(fn) {
      const listener = (args) => {
        const expectedArgsCount = this.registeredArguments.length;
        const actionArgs = args.slice(0, expectedArgsCount);
        if (this._storeOptionsAsProperties) {
          actionArgs[expectedArgsCount] = this;
        } else {
          actionArgs[expectedArgsCount] = this.opts();
        }
        actionArgs.push(this);
        return fn.apply(this, actionArgs);
      };
      this._actionHandler = listener;
      return this;
    }
    createOption(flags, description) {
      return new Option(flags, description);
    }
    _callParseArg(target, value, previous, invalidArgumentMessage) {
      try {
        return target.parseArg(value, previous);
      } catch (err) {
        if (err.code === "commander.invalidArgument") {
          const message = `${invalidArgumentMessage} ${err.message}`;
          this.error(message, { exitCode: err.exitCode, code: err.code });
        }
        throw err;
      }
    }
    _registerOption(option) {
      const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
      if (matchingOption) {
        const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
        throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
      }
      this._initOptionGroup(option);
      this.options.push(option);
    }
    _registerCommand(command) {
      const knownBy = (cmd) => {
        return [cmd.name()].concat(cmd.aliases());
      };
      const alreadyUsed = knownBy(command).find((name) => this._findCommand(name));
      if (alreadyUsed) {
        const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
        const newCmd = knownBy(command).join("|");
        throw new Error(`cannot add command '${newCmd}' as already have command '${existingCmd}'`);
      }
      this._initCommandGroup(command);
      this.commands.push(command);
    }
    addOption(option) {
      this._registerOption(option);
      const oname = option.name();
      const name = option.attributeName();
      if (option.negate) {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(name, option.defaultValue === undefined ? true : option.defaultValue, "default");
        }
      } else if (option.defaultValue !== undefined) {
        this.setOptionValueWithSource(name, option.defaultValue, "default");
      }
      const handleOptionValue = (val, invalidValueMessage, valueSource) => {
        if (val == null && option.presetArg !== undefined) {
          val = option.presetArg;
        }
        const oldValue = this.getOptionValue(name);
        if (val !== null && option.parseArg) {
          val = this._callParseArg(option, val, oldValue, invalidValueMessage);
        } else if (val !== null && option.variadic) {
          val = option._collectValue(val, oldValue);
        }
        if (val == null) {
          if (option.negate) {
            val = false;
          } else if (option.isBoolean() || option.optional) {
            val = true;
          } else {
            val = "";
          }
        }
        this.setOptionValueWithSource(name, val, valueSource);
      };
      this.on("option:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "cli");
      });
      if (option.envVar) {
        this.on("optionEnv:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "env");
        });
      }
      return this;
    }
    _optionEx(config, flags, description, fn, defaultValue) {
      if (typeof flags === "object" && flags instanceof Option) {
        throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
      }
      const option = this.createOption(flags, description);
      option.makeOptionMandatory(!!config.mandatory);
      if (typeof fn === "function") {
        option.default(defaultValue).argParser(fn);
      } else if (fn instanceof RegExp) {
        const regex = fn;
        fn = (val, def) => {
          const m = regex.exec(val);
          return m ? m[0] : def;
        };
        option.default(defaultValue).argParser(fn);
      } else {
        option.default(fn);
      }
      return this.addOption(option);
    }
    option(flags, description, parseArg, defaultValue) {
      return this._optionEx({}, flags, description, parseArg, defaultValue);
    }
    requiredOption(flags, description, parseArg, defaultValue) {
      return this._optionEx({ mandatory: true }, flags, description, parseArg, defaultValue);
    }
    combineFlagAndOptionalValue(combine = true) {
      this._combineFlagAndOptionalValue = !!combine;
      return this;
    }
    allowUnknownOption(allowUnknown = true) {
      this._allowUnknownOption = !!allowUnknown;
      return this;
    }
    allowExcessArguments(allowExcess = true) {
      this._allowExcessArguments = !!allowExcess;
      return this;
    }
    enablePositionalOptions(positional = true) {
      this._enablePositionalOptions = !!positional;
      return this;
    }
    passThroughOptions(passThrough = true) {
      this._passThroughOptions = !!passThrough;
      this._checkForBrokenPassThrough();
      return this;
    }
    _checkForBrokenPassThrough() {
      if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
        throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`);
      }
    }
    storeOptionsAsProperties(storeAsProperties = true) {
      if (this.options.length) {
        throw new Error("call .storeOptionsAsProperties() before adding options");
      }
      if (Object.keys(this._optionValues).length) {
        throw new Error("call .storeOptionsAsProperties() before setting option values");
      }
      this._storeOptionsAsProperties = !!storeAsProperties;
      return this;
    }
    getOptionValue(key) {
      if (this._storeOptionsAsProperties) {
        return this[key];
      }
      return this._optionValues[key];
    }
    setOptionValue(key, value) {
      return this.setOptionValueWithSource(key, value, undefined);
    }
    setOptionValueWithSource(key, value, source) {
      if (this._storeOptionsAsProperties) {
        this[key] = value;
      } else {
        this._optionValues[key] = value;
      }
      this._optionValueSources[key] = source;
      return this;
    }
    getOptionValueSource(key) {
      return this._optionValueSources[key];
    }
    getOptionValueSourceWithGlobals(key) {
      let source;
      this._getCommandAndAncestors().forEach((cmd) => {
        if (cmd.getOptionValueSource(key) !== undefined) {
          source = cmd.getOptionValueSource(key);
        }
      });
      return source;
    }
    _prepareUserArgs(argv, parseOptions) {
      if (argv !== undefined && !Array.isArray(argv)) {
        throw new Error("first parameter to parse must be array or undefined");
      }
      parseOptions = parseOptions || {};
      if (argv === undefined && parseOptions.from === undefined) {
        if (process3.versions?.electron) {
          parseOptions.from = "electron";
        }
        const execArgv = process3.execArgv ?? [];
        if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
          parseOptions.from = "eval";
        }
      }
      if (argv === undefined) {
        argv = process3.argv;
      }
      this.rawArgs = argv.slice();
      let userArgs;
      switch (parseOptions.from) {
        case undefined:
        case "node":
          this._scriptPath = argv[1];
          userArgs = argv.slice(2);
          break;
        case "electron":
          if (process3.defaultApp) {
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
          } else {
            userArgs = argv.slice(1);
          }
          break;
        case "user":
          userArgs = argv.slice(0);
          break;
        case "eval":
          userArgs = argv.slice(1);
          break;
        default:
          throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
      }
      if (!this._name && this._scriptPath)
        this.nameFromFilename(this._scriptPath);
      this._name = this._name || "program";
      return userArgs;
    }
    parse(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      this._parseCommand([], userArgs);
      return this;
    }
    async parseAsync(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      await this._parseCommand([], userArgs);
      return this;
    }
    _prepareForParse() {
      if (this._savedState === null) {
        this.saveStateBeforeParse();
      } else {
        this.restoreStateBeforeParse();
      }
    }
    saveStateBeforeParse() {
      this._savedState = {
        _name: this._name,
        _optionValues: { ...this._optionValues },
        _optionValueSources: { ...this._optionValueSources }
      };
    }
    restoreStateBeforeParse() {
      if (this._storeOptionsAsProperties)
        throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
      this._name = this._savedState._name;
      this._scriptPath = null;
      this.rawArgs = [];
      this._optionValues = { ...this._savedState._optionValues };
      this._optionValueSources = { ...this._savedState._optionValueSources };
      this.args = [];
      this.processedArgs = [];
    }
    _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
      if (fs.existsSync(executableFile))
        return;
      const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
      const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
      throw new Error(executableMissing);
    }
    _executeSubCommand(subcommand, args) {
      args = args.slice();
      let launchWithNode = false;
      const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
      function findFile(baseDir, baseName) {
        const localBin = path.resolve(baseDir, baseName);
        if (fs.existsSync(localBin))
          return localBin;
        if (sourceExt.includes(path.extname(baseName)))
          return;
        const foundExt = sourceExt.find((ext) => fs.existsSync(`${localBin}${ext}`));
        if (foundExt)
          return `${localBin}${foundExt}`;
        return;
      }
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
      let executableDir = this._executableDir || "";
      if (this._scriptPath) {
        let resolvedScriptPath;
        try {
          resolvedScriptPath = fs.realpathSync(this._scriptPath);
        } catch {
          resolvedScriptPath = this._scriptPath;
        }
        executableDir = path.resolve(path.dirname(resolvedScriptPath), executableDir);
      }
      if (executableDir) {
        let localFile = findFile(executableDir, executableFile);
        if (!localFile && !subcommand._executableFile && this._scriptPath) {
          const legacyName = path.basename(this._scriptPath, path.extname(this._scriptPath));
          if (legacyName !== this._name) {
            localFile = findFile(executableDir, `${legacyName}-${subcommand._name}`);
          }
        }
        executableFile = localFile || executableFile;
      }
      launchWithNode = sourceExt.includes(path.extname(executableFile));
      let proc;
      if (process3.platform !== "win32") {
        if (launchWithNode) {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process3.execArgv).concat(args);
          proc = childProcess.spawn(process3.argv[0], args, { stdio: "inherit" });
        } else {
          proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
        }
      } else {
        this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process3.execArgv).concat(args);
        proc = childProcess.spawn(process3.execPath, args, { stdio: "inherit" });
      }
      if (!proc.killed) {
        const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
        signals.forEach((signal) => {
          process3.on(signal, () => {
            if (proc.killed === false && proc.exitCode === null) {
              proc.kill(signal);
            }
          });
        });
      }
      const exitCallback = this._exitCallback;
      proc.on("close", (code) => {
        code = code ?? 1;
        if (!exitCallback) {
          process3.exit(code);
        } else {
          exitCallback(new CommanderError(code, "commander.executeSubCommandAsync", "(close)"));
        }
      });
      proc.on("error", (err) => {
        if (err.code === "ENOENT") {
          this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        } else if (err.code === "EACCES") {
          throw new Error(`'${executableFile}' not executable`);
        }
        if (!exitCallback) {
          process3.exit(1);
        } else {
          const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
          wrappedError.nestedError = err;
          exitCallback(wrappedError);
        }
      });
      this.runningCommand = proc;
    }
    _dispatchSubcommand(commandName, operands, unknown) {
      const subCommand = this._findCommand(commandName);
      if (!subCommand)
        this.help({ error: true });
      subCommand._prepareForParse();
      let promiseChain;
      promiseChain = this._chainOrCallSubCommandHook(promiseChain, subCommand, "preSubcommand");
      promiseChain = this._chainOrCall(promiseChain, () => {
        if (subCommand._executableHandler) {
          this._executeSubCommand(subCommand, operands.concat(unknown));
        } else {
          return subCommand._parseCommand(operands, unknown);
        }
      });
      return promiseChain;
    }
    _dispatchHelpCommand(subcommandName) {
      if (!subcommandName) {
        this.help();
      }
      const subCommand = this._findCommand(subcommandName);
      if (subCommand && !subCommand._executableHandler) {
        subCommand.help();
      }
      return this._dispatchSubcommand(subcommandName, [], [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]);
    }
    _checkNumberOfArguments() {
      this.registeredArguments.forEach((arg, i) => {
        if (arg.required && this.args[i] == null) {
          this.missingArgument(arg.name());
        }
      });
      if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
        return;
      }
      if (this.args.length > this.registeredArguments.length) {
        this._excessArguments(this.args);
      }
    }
    _processArguments() {
      const myParseArg = (argument, value, previous) => {
        let parsedValue = value;
        if (value !== null && argument.parseArg) {
          const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
          parsedValue = this._callParseArg(argument, value, previous, invalidValueMessage);
        }
        return parsedValue;
      };
      this._checkNumberOfArguments();
      const processedArgs = [];
      this.registeredArguments.forEach((declaredArg, index) => {
        let value = declaredArg.defaultValue;
        if (declaredArg.variadic) {
          if (index < this.args.length) {
            value = this.args.slice(index);
            if (declaredArg.parseArg) {
              value = value.reduce((processed, v) => {
                return myParseArg(declaredArg, v, processed);
              }, declaredArg.defaultValue);
            }
          } else if (value === undefined) {
            value = [];
          }
        } else if (index < this.args.length) {
          value = this.args[index];
          if (declaredArg.parseArg) {
            value = myParseArg(declaredArg, value, declaredArg.defaultValue);
          }
        }
        processedArgs[index] = value;
      });
      this.processedArgs = processedArgs;
    }
    _chainOrCall(promise, fn) {
      if (promise?.then && typeof promise.then === "function") {
        return promise.then(() => fn());
      }
      return fn();
    }
    _chainOrCallHooks(promise, event) {
      let result = promise;
      const hooks = [];
      this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== undefined).forEach((hookedCommand) => {
        hookedCommand._lifeCycleHooks[event].forEach((callback) => {
          hooks.push({ hookedCommand, callback });
        });
      });
      if (event === "postAction") {
        hooks.reverse();
      }
      hooks.forEach((hookDetail) => {
        result = this._chainOrCall(result, () => {
          return hookDetail.callback(hookDetail.hookedCommand, this);
        });
      });
      return result;
    }
    _chainOrCallSubCommandHook(promise, subCommand, event) {
      let result = promise;
      if (this._lifeCycleHooks[event] !== undefined) {
        this._lifeCycleHooks[event].forEach((hook) => {
          result = this._chainOrCall(result, () => {
            return hook(this, subCommand);
          });
        });
      }
      return result;
    }
    _parseCommand(operands, unknown) {
      const parsed = this.parseOptions(unknown);
      this._parseOptionsEnv();
      this._parseOptionsImplied();
      operands = operands.concat(parsed.operands);
      unknown = parsed.unknown;
      this.args = operands.concat(unknown);
      if (operands && this._findCommand(operands[0])) {
        return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
      }
      if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
        return this._dispatchHelpCommand(operands[1]);
      }
      if (this._defaultCommandName) {
        this._outputHelpIfRequested(unknown);
        return this._dispatchSubcommand(this._defaultCommandName, operands, unknown);
      }
      if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
        this.help({ error: true });
      }
      this._outputHelpIfRequested(parsed.unknown);
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      const checkForUnknownOptions = () => {
        if (parsed.unknown.length > 0) {
          this.unknownOption(parsed.unknown[0]);
        }
      };
      const commandEvent = `command:${this.name()}`;
      if (this._actionHandler) {
        checkForUnknownOptions();
        this._processArguments();
        let promiseChain;
        promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
        promiseChain = this._chainOrCall(promiseChain, () => this._actionHandler(this.processedArgs));
        if (this.parent) {
          promiseChain = this._chainOrCall(promiseChain, () => {
            this.parent.emit(commandEvent, operands, unknown);
          });
        }
        promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
        return promiseChain;
      }
      if (this.parent?.listenerCount(commandEvent)) {
        checkForUnknownOptions();
        this._processArguments();
        this.parent.emit(commandEvent, operands, unknown);
      } else if (operands.length) {
        if (this._findCommand("*")) {
          return this._dispatchSubcommand("*", operands, unknown);
        }
        if (this.listenerCount("command:*")) {
          this.emit("command:*", operands, unknown);
        } else if (this.commands.length) {
          this.unknownCommand();
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      } else if (this.commands.length) {
        checkForUnknownOptions();
        this.help({ error: true });
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    }
    _findCommand(name) {
      if (!name)
        return;
      return this.commands.find((cmd) => cmd._name === name || cmd._aliases.includes(name));
    }
    _findOption(arg) {
      return this.options.find((option) => option.is(arg));
    }
    _checkForMissingMandatoryOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd.options.forEach((anOption) => {
          if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === undefined) {
            cmd.missingMandatoryOptionValue(anOption);
          }
        });
      });
    }
    _checkForConflictingLocalOptions() {
      const definedNonDefaultOptions = this.options.filter((option) => {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === undefined) {
          return false;
        }
        return this.getOptionValueSource(optionKey) !== "default";
      });
      const optionsWithConflicting = definedNonDefaultOptions.filter((option) => option.conflictsWith.length > 0);
      optionsWithConflicting.forEach((option) => {
        const conflictingAndDefined = definedNonDefaultOptions.find((defined) => option.conflictsWith.includes(defined.attributeName()));
        if (conflictingAndDefined) {
          this._conflictingOption(option, conflictingAndDefined);
        }
      });
    }
    _checkForConflictingOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd._checkForConflictingLocalOptions();
      });
    }
    parseOptions(args) {
      const operands = [];
      const unknown = [];
      let dest = operands;
      function maybeOption(arg) {
        return arg.length > 1 && arg[0] === "-";
      }
      const negativeNumberArg = (arg) => {
        if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg))
          return false;
        return !this._getCommandAndAncestors().some((cmd) => cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short)));
      };
      let activeVariadicOption = null;
      let activeGroup = null;
      let i = 0;
      while (i < args.length || activeGroup) {
        const arg = activeGroup ?? args[i++];
        activeGroup = null;
        if (arg === "--") {
          if (dest === unknown)
            dest.push(arg);
          dest.push(...args.slice(i));
          break;
        }
        if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
          this.emit(`option:${activeVariadicOption.name()}`, arg);
          continue;
        }
        activeVariadicOption = null;
        if (maybeOption(arg)) {
          const option = this._findOption(arg);
          if (option) {
            if (option.required) {
              const value = args[i++];
              if (value === undefined)
                this.optionMissingArgument(option);
              this.emit(`option:${option.name()}`, value);
            } else if (option.optional) {
              let value = null;
              if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) {
                value = args[i++];
              }
              this.emit(`option:${option.name()}`, value);
            } else {
              this.emit(`option:${option.name()}`);
            }
            activeVariadicOption = option.variadic ? option : null;
            continue;
          }
        }
        if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
          const option = this._findOption(`-${arg[1]}`);
          if (option) {
            if (option.required || option.optional && this._combineFlagAndOptionalValue) {
              this.emit(`option:${option.name()}`, arg.slice(2));
            } else {
              this.emit(`option:${option.name()}`);
              activeGroup = `-${arg.slice(2)}`;
            }
            continue;
          }
        }
        if (/^--[^=]+=/.test(arg)) {
          const index = arg.indexOf("=");
          const option = this._findOption(arg.slice(0, index));
          if (option && (option.required || option.optional)) {
            this.emit(`option:${option.name()}`, arg.slice(index + 1));
            continue;
          }
        }
        if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
          dest = unknown;
        }
        if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
          if (this._findCommand(arg)) {
            operands.push(arg);
            unknown.push(...args.slice(i));
            break;
          } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
            operands.push(arg, ...args.slice(i));
            break;
          } else if (this._defaultCommandName) {
            unknown.push(arg, ...args.slice(i));
            break;
          }
        }
        if (this._passThroughOptions) {
          dest.push(arg, ...args.slice(i));
          break;
        }
        dest.push(arg);
      }
      return { operands, unknown };
    }
    opts() {
      if (this._storeOptionsAsProperties) {
        const result = {};
        const len = this.options.length;
        for (let i = 0;i < len; i++) {
          const key = this.options[i].attributeName();
          result[key] = key === this._versionOptionName ? this._version : this[key];
        }
        return result;
      }
      return this._optionValues;
    }
    optsWithGlobals() {
      return this._getCommandAndAncestors().reduce((combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()), {});
    }
    error(message, errorOptions) {
      this._outputConfiguration.outputError(`${message}
`, this._outputConfiguration.writeErr);
      if (typeof this._showHelpAfterError === "string") {
        this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
      } else if (this._showHelpAfterError) {
        this._outputConfiguration.writeErr(`
`);
        this.outputHelp({ error: true });
      }
      const config = errorOptions || {};
      const exitCode = config.exitCode || 1;
      const code = config.code || "commander.error";
      this._exit(exitCode, code, message);
    }
    _parseOptionsEnv() {
      this.options.forEach((option) => {
        if (option.envVar && option.envVar in process3.env) {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === undefined || ["default", "config", "env"].includes(this.getOptionValueSource(optionKey))) {
            if (option.required || option.optional) {
              this.emit(`optionEnv:${option.name()}`, process3.env[option.envVar]);
            } else {
              this.emit(`optionEnv:${option.name()}`);
            }
          }
        }
      });
    }
    _parseOptionsImplied() {
      const dualHelper = new DualOptions(this.options);
      const hasCustomOptionValue = (optionKey) => {
        return this.getOptionValue(optionKey) !== undefined && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
      };
      this.options.filter((option) => option.implied !== undefined && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(this.getOptionValue(option.attributeName()), option)).forEach((option) => {
        Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
          this.setOptionValueWithSource(impliedKey, option.implied[impliedKey], "implied");
        });
      });
    }
    missingArgument(name) {
      const message = `error: missing required argument '${name}'`;
      this.error(message, { code: "commander.missingArgument" });
    }
    optionMissingArgument(option) {
      const message = `error: option '${option.flags}' argument missing`;
      this.error(message, { code: "commander.optionMissingArgument" });
    }
    missingMandatoryOptionValue(option) {
      const message = `error: required option '${option.flags}' not specified`;
      this.error(message, { code: "commander.missingMandatoryOptionValue" });
    }
    _conflictingOption(option, conflictingOption) {
      const findBestOptionFromValue = (option2) => {
        const optionKey = option2.attributeName();
        const optionValue = this.getOptionValue(optionKey);
        const negativeOption = this.options.find((target) => target.negate && optionKey === target.attributeName());
        const positiveOption = this.options.find((target) => !target.negate && optionKey === target.attributeName());
        if (negativeOption && (negativeOption.presetArg === undefined && optionValue === false || negativeOption.presetArg !== undefined && optionValue === negativeOption.presetArg)) {
          return negativeOption;
        }
        return positiveOption || option2;
      };
      const getErrorMessage = (option2) => {
        const bestOption = findBestOptionFromValue(option2);
        const optionKey = bestOption.attributeName();
        const source = this.getOptionValueSource(optionKey);
        if (source === "env") {
          return `environment variable '${bestOption.envVar}'`;
        }
        return `option '${bestOption.flags}'`;
      };
      const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
      this.error(message, { code: "commander.conflictingOption" });
    }
    unknownOption(flag) {
      if (this._allowUnknownOption)
        return;
      let suggestion = "";
      if (flag.startsWith("--") && this._showSuggestionAfterError) {
        let candidateFlags = [];
        let command = this;
        do {
          const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
          candidateFlags = candidateFlags.concat(moreFlags);
          command = command.parent;
        } while (command && !command._enablePositionalOptions);
        suggestion = suggestSimilar(flag, candidateFlags);
      }
      const message = `error: unknown option '${flag}'${suggestion}`;
      this.error(message, { code: "commander.unknownOption" });
    }
    _excessArguments(receivedArgs) {
      if (this._allowExcessArguments)
        return;
      const expected = this.registeredArguments.length;
      const s = expected === 1 ? "" : "s";
      const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
      const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
      this.error(message, { code: "commander.excessArguments" });
    }
    unknownCommand() {
      const unknownName = this.args[0];
      let suggestion = "";
      if (this._showSuggestionAfterError) {
        const candidateNames = [];
        this.createHelp().visibleCommands(this).forEach((command) => {
          candidateNames.push(command.name());
          if (command.alias())
            candidateNames.push(command.alias());
        });
        suggestion = suggestSimilar(unknownName, candidateNames);
      }
      const message = `error: unknown command '${unknownName}'${suggestion}`;
      this.error(message, { code: "commander.unknownCommand" });
    }
    version(str, flags, description) {
      if (str === undefined)
        return this._version;
      this._version = str;
      flags = flags || "-V, --version";
      description = description || "output the version number";
      const versionOption = this.createOption(flags, description);
      this._versionOptionName = versionOption.attributeName();
      this._registerOption(versionOption);
      this.on("option:" + versionOption.name(), () => {
        this._outputConfiguration.writeOut(`${str}
`);
        this._exit(0, "commander.version", str);
      });
      return this;
    }
    description(str, argsDescription) {
      if (str === undefined && argsDescription === undefined)
        return this._description;
      this._description = str;
      if (argsDescription) {
        this._argsDescription = argsDescription;
      }
      return this;
    }
    summary(str) {
      if (str === undefined)
        return this._summary;
      this._summary = str;
      return this;
    }
    alias(alias) {
      if (alias === undefined)
        return this._aliases[0];
      let command = this;
      if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
        command = this.commands[this.commands.length - 1];
      }
      if (alias === command._name)
        throw new Error("Command alias can't be the same as its name");
      const matchingCommand = this.parent?._findCommand(alias);
      if (matchingCommand) {
        const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
        throw new Error(`cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`);
      }
      command._aliases.push(alias);
      return this;
    }
    aliases(aliases) {
      if (aliases === undefined)
        return this._aliases;
      aliases.forEach((alias) => this.alias(alias));
      return this;
    }
    usage(str) {
      if (str === undefined) {
        if (this._usage)
          return this._usage;
        const args = this.registeredArguments.map((arg) => {
          return humanReadableArgName(arg);
        });
        return [].concat(this.options.length || this._helpOption !== null ? "[options]" : [], this.commands.length ? "[command]" : [], this.registeredArguments.length ? args : []).join(" ");
      }
      this._usage = str;
      return this;
    }
    name(str) {
      if (str === undefined)
        return this._name;
      this._name = str;
      return this;
    }
    helpGroup(heading) {
      if (heading === undefined)
        return this._helpGroupHeading ?? "";
      this._helpGroupHeading = heading;
      return this;
    }
    commandsGroup(heading) {
      if (heading === undefined)
        return this._defaultCommandGroup ?? "";
      this._defaultCommandGroup = heading;
      return this;
    }
    optionsGroup(heading) {
      if (heading === undefined)
        return this._defaultOptionGroup ?? "";
      this._defaultOptionGroup = heading;
      return this;
    }
    _initOptionGroup(option) {
      if (this._defaultOptionGroup && !option.helpGroupHeading)
        option.helpGroup(this._defaultOptionGroup);
    }
    _initCommandGroup(cmd) {
      if (this._defaultCommandGroup && !cmd.helpGroup())
        cmd.helpGroup(this._defaultCommandGroup);
    }
    nameFromFilename(filename) {
      this._name = path.basename(filename, path.extname(filename));
      return this;
    }
    executableDir(path2) {
      if (path2 === undefined)
        return this._executableDir;
      this._executableDir = path2;
      return this;
    }
    helpInformation(contextOptions) {
      const helper = this.createHelp();
      const context = this._getOutputContext(contextOptions);
      helper.prepareContext({
        error: context.error,
        helpWidth: context.helpWidth,
        outputHasColors: context.hasColors
      });
      const text = helper.formatHelp(this, helper);
      if (context.hasColors)
        return text;
      return this._outputConfiguration.stripColor(text);
    }
    _getOutputContext(contextOptions) {
      contextOptions = contextOptions || {};
      const error = !!contextOptions.error;
      let baseWrite;
      let hasColors;
      let helpWidth;
      if (error) {
        baseWrite = (str) => this._outputConfiguration.writeErr(str);
        hasColors = this._outputConfiguration.getErrHasColors();
        helpWidth = this._outputConfiguration.getErrHelpWidth();
      } else {
        baseWrite = (str) => this._outputConfiguration.writeOut(str);
        hasColors = this._outputConfiguration.getOutHasColors();
        helpWidth = this._outputConfiguration.getOutHelpWidth();
      }
      const write = (str) => {
        if (!hasColors)
          str = this._outputConfiguration.stripColor(str);
        return baseWrite(str);
      };
      return { error, write, hasColors, helpWidth };
    }
    outputHelp(contextOptions) {
      let deprecatedCallback;
      if (typeof contextOptions === "function") {
        deprecatedCallback = contextOptions;
        contextOptions = undefined;
      }
      const outputContext = this._getOutputContext(contextOptions);
      const eventContext = {
        error: outputContext.error,
        write: outputContext.write,
        command: this
      };
      this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
      this.emit("beforeHelp", eventContext);
      let helpInformation = this.helpInformation({ error: outputContext.error });
      if (deprecatedCallback) {
        helpInformation = deprecatedCallback(helpInformation);
        if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
          throw new Error("outputHelp callback must return a string or a Buffer");
        }
      }
      outputContext.write(helpInformation);
      if (this._getHelpOption()?.long) {
        this.emit(this._getHelpOption().long);
      }
      this.emit("afterHelp", eventContext);
      this._getCommandAndAncestors().forEach((command) => command.emit("afterAllHelp", eventContext));
    }
    helpOption(flags, description) {
      if (typeof flags === "boolean") {
        if (flags) {
          if (this._helpOption === null)
            this._helpOption = undefined;
          if (this._defaultOptionGroup) {
            this._initOptionGroup(this._getHelpOption());
          }
        } else {
          this._helpOption = null;
        }
        return this;
      }
      this._helpOption = this.createOption(flags ?? "-h, --help", description ?? "display help for command");
      if (flags || description)
        this._initOptionGroup(this._helpOption);
      return this;
    }
    _getHelpOption() {
      if (this._helpOption === undefined) {
        this.helpOption(undefined, undefined);
      }
      return this._helpOption;
    }
    addHelpOption(option) {
      this._helpOption = option;
      this._initOptionGroup(option);
      return this;
    }
    help(contextOptions) {
      this.outputHelp(contextOptions);
      let exitCode = Number(process3.exitCode ?? 0);
      if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
        exitCode = 1;
      }
      this._exit(exitCode, "commander.help", "(outputHelp)");
    }
    addHelpText(position, text) {
      const allowedValues = ["beforeAll", "before", "after", "afterAll"];
      if (!allowedValues.includes(position)) {
        throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      const helpEvent = `${position}Help`;
      this.on(helpEvent, (context) => {
        let helpStr;
        if (typeof text === "function") {
          helpStr = text({ error: context.error, command: context.command });
        } else {
          helpStr = text;
        }
        if (helpStr) {
          context.write(`${helpStr}
`);
        }
      });
      return this;
    }
    _outputHelpIfRequested(args) {
      const helpOption = this._getHelpOption();
      const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
      if (helpRequested) {
        this.outputHelp();
        this._exit(0, "commander.helpDisplayed", "(outputHelp)");
      }
    }
  }
  function incrementNodeInspectorPort(args) {
    return args.map((arg) => {
      if (!arg.startsWith("--inspect")) {
        return arg;
      }
      let debugOption;
      let debugHost = "127.0.0.1";
      let debugPort = "9229";
      let match;
      if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
        debugOption = match[1];
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
        debugOption = match[1];
        if (/^\d+$/.test(match[3])) {
          debugPort = match[3];
        } else {
          debugHost = match[3];
        }
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
        debugOption = match[1];
        debugHost = match[3];
        debugPort = match[4];
      }
      if (debugOption && debugPort !== "0") {
        return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
      }
      return arg;
    });
  }
  function useColor() {
    if (process3.env.NO_COLOR || process3.env.FORCE_COLOR === "0" || process3.env.FORCE_COLOR === "false")
      return false;
    if (process3.env.FORCE_COLOR || process3.env.CLICOLOR_FORCE !== undefined)
      return true;
    return;
  }
  exports.Command = Command;
  exports.useColor = useColor;
});

// node_modules/commander/index.js
var require_commander = __commonJS((exports) => {
  var { Argument } = require_argument();
  var { Command } = require_command();
  var { CommanderError, InvalidArgumentError } = require_error();
  var { Help } = require_help();
  var { Option } = require_option();
  exports.program = new Command;
  exports.createCommand = (name) => new Command(name);
  exports.createOption = (flags, description) => new Option(flags, description);
  exports.createArgument = (name, description) => new Argument(name, description);
  exports.Command = Command;
  exports.Option = Option;
  exports.Argument = Argument;
  exports.Help = Help;
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
  exports.InvalidOptionArgumentError = InvalidArgumentError;
});

// node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/debug.js
var require_debug = __commonJS((exports, module) => {
  var messages = [];
  var level = 0;
  var debug = (msg, min) => {
    if (level >= min) {
      messages.push(msg);
    }
  };
  debug.WARN = 1;
  debug.INFO = 2;
  debug.DEBUG = 3;
  debug.reset = () => {
    messages = [];
  };
  debug.setDebugLevel = (v) => {
    level = v;
  };
  debug.warn = (msg) => debug(msg, debug.WARN);
  debug.info = (msg) => debug(msg, debug.INFO);
  debug.debug = (msg) => debug(msg, debug.DEBUG);
  debug.debugMessages = () => messages;
  module.exports = debug;
});

// node_modules/.pnpm/ansi-regex@5.0.1/node_modules/ansi-regex/index.js
var require_ansi_regex = __commonJS((exports, module) => {
  module.exports = ({ onlyFirst = false } = {}) => {
    const pattern = [
      "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
      "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
    ].join("|");
    return new RegExp(pattern, onlyFirst ? undefined : "g");
  };
});

// node_modules/.pnpm/strip-ansi@6.0.1/node_modules/strip-ansi/index.js
var require_strip_ansi = __commonJS((exports, module) => {
  var ansiRegex = require_ansi_regex();
  module.exports = (string) => typeof string === "string" ? string.replace(ansiRegex(), "") : string;
});

// node_modules/.pnpm/is-fullwidth-code-point@3.0.0/node_modules/is-fullwidth-code-point/index.js
var require_is_fullwidth_code_point = __commonJS((exports, module) => {
  var isFullwidthCodePoint = (codePoint) => {
    if (Number.isNaN(codePoint)) {
      return false;
    }
    if (codePoint >= 4352 && (codePoint <= 4447 || codePoint === 9001 || codePoint === 9002 || 11904 <= codePoint && codePoint <= 12871 && codePoint !== 12351 || 12880 <= codePoint && codePoint <= 19903 || 19968 <= codePoint && codePoint <= 42182 || 43360 <= codePoint && codePoint <= 43388 || 44032 <= codePoint && codePoint <= 55203 || 63744 <= codePoint && codePoint <= 64255 || 65040 <= codePoint && codePoint <= 65049 || 65072 <= codePoint && codePoint <= 65131 || 65281 <= codePoint && codePoint <= 65376 || 65504 <= codePoint && codePoint <= 65510 || 110592 <= codePoint && codePoint <= 110593 || 127488 <= codePoint && codePoint <= 127569 || 131072 <= codePoint && codePoint <= 262141)) {
      return true;
    }
    return false;
  };
  module.exports = isFullwidthCodePoint;
  module.exports.default = isFullwidthCodePoint;
});

// node_modules/.pnpm/emoji-regex@8.0.0/node_modules/emoji-regex/index.js
var require_emoji_regex = __commonJS((exports, module) => {
  module.exports = function() {
    return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F|\uD83D\uDC68(?:\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|[\u2695\u2696\u2708]\uFE0F|\uD83D[\uDC66\uDC67]|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708])\uFE0F|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C[\uDFFB-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)\uD83C\uDFFB|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB\uDFFC])|\uD83D\uDC69(?:\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB-\uDFFD])|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\uD83C\uDFF4\u200D\u2620)\uFE0F|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDF6\uD83C\uDDE6|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDBB\uDDD2-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5\uDEEB\uDEEC\uDEF4-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
  };
});

// node_modules/.pnpm/string-width@4.2.3/node_modules/string-width/index.js
var require_string_width = __commonJS((exports, module) => {
  var stripAnsi = require_strip_ansi();
  var isFullwidthCodePoint = require_is_fullwidth_code_point();
  var emojiRegex = require_emoji_regex();
  var stringWidth = (string) => {
    if (typeof string !== "string" || string.length === 0) {
      return 0;
    }
    string = stripAnsi(string);
    if (string.length === 0) {
      return 0;
    }
    string = string.replace(emojiRegex(), "  ");
    let width = 0;
    for (let i = 0;i < string.length; i++) {
      const code = string.codePointAt(i);
      if (code <= 31 || code >= 127 && code <= 159) {
        continue;
      }
      if (code >= 768 && code <= 879) {
        continue;
      }
      if (code > 65535) {
        i++;
      }
      width += isFullwidthCodePoint(code) ? 2 : 1;
    }
    return width;
  };
  module.exports = stringWidth;
  module.exports.default = stringWidth;
});

// node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/utils.js
var require_utils = __commonJS((exports, module) => {
  var stringWidth = require_string_width();
  function codeRegex(capture) {
    return capture ? /\u001b\[((?:\d*;){0,5}\d*)m/g : /\u001b\[(?:\d*;){0,5}\d*m/g;
  }
  function strlen(str) {
    let code = codeRegex();
    let stripped = ("" + str).replace(code, "");
    let split = stripped.split(`
`);
    return split.reduce(function(memo, s) {
      return stringWidth(s) > memo ? stringWidth(s) : memo;
    }, 0);
  }
  function repeat(str, times) {
    return Array(times + 1).join(str);
  }
  function pad(str, len, pad2, dir) {
    let length = strlen(str);
    if (len + 1 >= length) {
      let padlen = len - length;
      switch (dir) {
        case "right": {
          str = repeat(pad2, padlen) + str;
          break;
        }
        case "center": {
          let right = Math.ceil(padlen / 2);
          let left = padlen - right;
          str = repeat(pad2, left) + str + repeat(pad2, right);
          break;
        }
        default: {
          str = str + repeat(pad2, padlen);
          break;
        }
      }
    }
    return str;
  }
  var codeCache = {};
  function addToCodeCache(name, on, off) {
    on = "\x1B[" + on + "m";
    off = "\x1B[" + off + "m";
    codeCache[on] = { set: name, to: true };
    codeCache[off] = { set: name, to: false };
    codeCache[name] = { on, off };
  }
  addToCodeCache("bold", 1, 22);
  addToCodeCache("italics", 3, 23);
  addToCodeCache("underline", 4, 24);
  addToCodeCache("inverse", 7, 27);
  addToCodeCache("strikethrough", 9, 29);
  function updateState(state, controlChars) {
    let controlCode = controlChars[1] ? parseInt(controlChars[1].split(";")[0]) : 0;
    if (controlCode >= 30 && controlCode <= 39 || controlCode >= 90 && controlCode <= 97) {
      state.lastForegroundAdded = controlChars[0];
      return;
    }
    if (controlCode >= 40 && controlCode <= 49 || controlCode >= 100 && controlCode <= 107) {
      state.lastBackgroundAdded = controlChars[0];
      return;
    }
    if (controlCode === 0) {
      for (let i in state) {
        if (Object.prototype.hasOwnProperty.call(state, i)) {
          delete state[i];
        }
      }
      return;
    }
    let info = codeCache[controlChars[0]];
    if (info) {
      state[info.set] = info.to;
    }
  }
  function readState(line) {
    let code = codeRegex(true);
    let controlChars = code.exec(line);
    let state = {};
    while (controlChars !== null) {
      updateState(state, controlChars);
      controlChars = code.exec(line);
    }
    return state;
  }
  function unwindState(state, ret) {
    let lastBackgroundAdded = state.lastBackgroundAdded;
    let lastForegroundAdded = state.lastForegroundAdded;
    delete state.lastBackgroundAdded;
    delete state.lastForegroundAdded;
    Object.keys(state).forEach(function(key) {
      if (state[key]) {
        ret += codeCache[key].off;
      }
    });
    if (lastBackgroundAdded && lastBackgroundAdded != "\x1B[49m") {
      ret += "\x1B[49m";
    }
    if (lastForegroundAdded && lastForegroundAdded != "\x1B[39m") {
      ret += "\x1B[39m";
    }
    return ret;
  }
  function rewindState(state, ret) {
    let lastBackgroundAdded = state.lastBackgroundAdded;
    let lastForegroundAdded = state.lastForegroundAdded;
    delete state.lastBackgroundAdded;
    delete state.lastForegroundAdded;
    Object.keys(state).forEach(function(key) {
      if (state[key]) {
        ret = codeCache[key].on + ret;
      }
    });
    if (lastBackgroundAdded && lastBackgroundAdded != "\x1B[49m") {
      ret = lastBackgroundAdded + ret;
    }
    if (lastForegroundAdded && lastForegroundAdded != "\x1B[39m") {
      ret = lastForegroundAdded + ret;
    }
    return ret;
  }
  function truncateWidth(str, desiredLength) {
    if (str.length === strlen(str)) {
      return str.substr(0, desiredLength);
    }
    while (strlen(str) > desiredLength) {
      str = str.slice(0, -1);
    }
    return str;
  }
  function truncateWidthWithAnsi(str, desiredLength) {
    let code = codeRegex(true);
    let split = str.split(codeRegex());
    let splitIndex = 0;
    let retLen = 0;
    let ret = "";
    let myArray;
    let state = {};
    while (retLen < desiredLength) {
      myArray = code.exec(str);
      let toAdd = split[splitIndex];
      splitIndex++;
      if (retLen + strlen(toAdd) > desiredLength) {
        toAdd = truncateWidth(toAdd, desiredLength - retLen);
      }
      ret += toAdd;
      retLen += strlen(toAdd);
      if (retLen < desiredLength) {
        if (!myArray) {
          break;
        }
        ret += myArray[0];
        updateState(state, myArray);
      }
    }
    return unwindState(state, ret);
  }
  function truncate(str, desiredLength, truncateChar) {
    truncateChar = truncateChar || "…";
    let lengthOfStr = strlen(str);
    if (lengthOfStr <= desiredLength) {
      return str;
    }
    desiredLength -= strlen(truncateChar);
    let ret = truncateWidthWithAnsi(str, desiredLength);
    ret += truncateChar;
    const hrefTag = "\x1B]8;;\x07";
    if (str.includes(hrefTag) && !ret.includes(hrefTag)) {
      ret += hrefTag;
    }
    return ret;
  }
  function defaultOptions() {
    return {
      chars: {
        top: "─",
        "top-mid": "┬",
        "top-left": "┌",
        "top-right": "┐",
        bottom: "─",
        "bottom-mid": "┴",
        "bottom-left": "└",
        "bottom-right": "┘",
        left: "│",
        "left-mid": "├",
        mid: "─",
        "mid-mid": "┼",
        right: "│",
        "right-mid": "┤",
        middle: "│"
      },
      truncate: "…",
      colWidths: [],
      rowHeights: [],
      colAligns: [],
      rowAligns: [],
      style: {
        "padding-left": 1,
        "padding-right": 1,
        head: ["red"],
        border: ["grey"],
        compact: false
      },
      head: []
    };
  }
  function mergeOptions(options, defaults) {
    options = options || {};
    defaults = defaults || defaultOptions();
    let ret = Object.assign({}, defaults, options);
    ret.chars = Object.assign({}, defaults.chars, options.chars);
    ret.style = Object.assign({}, defaults.style, options.style);
    return ret;
  }
  function wordWrap(maxLength, input) {
    let lines = [];
    let split = input.split(/(\s+)/g);
    let line = [];
    let lineLength = 0;
    let whitespace;
    for (let i = 0;i < split.length; i += 2) {
      let word = split[i];
      let newLength = lineLength + strlen(word);
      if (lineLength > 0 && whitespace) {
        newLength += whitespace.length;
      }
      if (newLength > maxLength) {
        if (lineLength !== 0) {
          lines.push(line.join(""));
        }
        line = [word];
        lineLength = strlen(word);
      } else {
        line.push(whitespace || "", word);
        lineLength = newLength;
      }
      whitespace = split[i + 1];
    }
    if (lineLength) {
      lines.push(line.join(""));
    }
    return lines;
  }
  function textWrap(maxLength, input) {
    let lines = [];
    let line = "";
    function pushLine(str, ws) {
      if (line.length && ws)
        line += ws;
      line += str;
      while (line.length > maxLength) {
        lines.push(line.slice(0, maxLength));
        line = line.slice(maxLength);
      }
    }
    let split = input.split(/(\s+)/g);
    for (let i = 0;i < split.length; i += 2) {
      pushLine(split[i], i && split[i - 1]);
    }
    if (line.length)
      lines.push(line);
    return lines;
  }
  function multiLineWordWrap(maxLength, input, wrapOnWordBoundary = true) {
    let output = [];
    input = input.split(`
`);
    const handler = wrapOnWordBoundary ? wordWrap : textWrap;
    for (let i = 0;i < input.length; i++) {
      output.push.apply(output, handler(maxLength, input[i]));
    }
    return output;
  }
  function colorizeLines(input) {
    let state = {};
    let output = [];
    for (let i = 0;i < input.length; i++) {
      let line = rewindState(state, input[i]);
      state = readState(line);
      let temp = Object.assign({}, state);
      output.push(unwindState(temp, line));
    }
    return output;
  }
  function hyperlink(url, text) {
    const OSC = "\x1B]";
    const BEL = "\x07";
    const SEP = ";";
    return [OSC, "8", SEP, SEP, url || text, BEL, text, OSC, "8", SEP, SEP, BEL].join("");
  }
  module.exports = {
    strlen,
    repeat,
    pad,
    truncate,
    mergeOptions,
    wordWrap: multiLineWordWrap,
    colorizeLines,
    hyperlink
  };
});

// node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/styles.js
var require_styles = __commonJS((exports, module) => {
  var styles4 = {};
  module["exports"] = styles4;
  var codes = {
    reset: [0, 0],
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29],
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    gray: [90, 39],
    grey: [90, 39],
    brightRed: [91, 39],
    brightGreen: [92, 39],
    brightYellow: [93, 39],
    brightBlue: [94, 39],
    brightMagenta: [95, 39],
    brightCyan: [96, 39],
    brightWhite: [97, 39],
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    bgGray: [100, 49],
    bgGrey: [100, 49],
    bgBrightRed: [101, 49],
    bgBrightGreen: [102, 49],
    bgBrightYellow: [103, 49],
    bgBrightBlue: [104, 49],
    bgBrightMagenta: [105, 49],
    bgBrightCyan: [106, 49],
    bgBrightWhite: [107, 49],
    blackBG: [40, 49],
    redBG: [41, 49],
    greenBG: [42, 49],
    yellowBG: [43, 49],
    blueBG: [44, 49],
    magentaBG: [45, 49],
    cyanBG: [46, 49],
    whiteBG: [47, 49]
  };
  Object.keys(codes).forEach(function(key) {
    var val = codes[key];
    var style = styles4[key] = [];
    style.open = "\x1B[" + val[0] + "m";
    style.close = "\x1B[" + val[1] + "m";
  });
});

// node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/system/has-flag.js
var require_has_flag = __commonJS((exports, module) => {
  module.exports = function(flag, argv) {
    argv = argv || process.argv;
    var terminatorPos = argv.indexOf("--");
    var prefix = /^-{1,2}/.test(flag) ? "" : "--";
    var pos = argv.indexOf(prefix + flag);
    return pos !== -1 && (terminatorPos === -1 ? true : pos < terminatorPos);
  };
});

// node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/system/supports-colors.js
var require_supports_colors = __commonJS((exports, module) => {
  var os2 = __require("os");
  var hasFlag2 = require_has_flag();
  var env2 = process.env;
  var forceColor = undefined;
  if (hasFlag2("no-color") || hasFlag2("no-colors") || hasFlag2("color=false")) {
    forceColor = false;
  } else if (hasFlag2("color") || hasFlag2("colors") || hasFlag2("color=true") || hasFlag2("color=always")) {
    forceColor = true;
  }
  if ("FORCE_COLOR" in env2) {
    forceColor = env2.FORCE_COLOR.length === 0 || parseInt(env2.FORCE_COLOR, 10) !== 0;
  }
  function translateLevel2(level) {
    if (level === 0) {
      return false;
    }
    return {
      level,
      hasBasic: true,
      has256: level >= 2,
      has16m: level >= 3
    };
  }
  function supportsColor2(stream) {
    if (forceColor === false) {
      return 0;
    }
    if (hasFlag2("color=16m") || hasFlag2("color=full") || hasFlag2("color=truecolor")) {
      return 3;
    }
    if (hasFlag2("color=256")) {
      return 2;
    }
    if (stream && !stream.isTTY && forceColor !== true) {
      return 0;
    }
    var min = forceColor ? 1 : 0;
    if (process.platform === "win32") {
      var osRelease = os2.release().split(".");
      if (Number(process.versions.node.split(".")[0]) >= 8 && Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
        return Number(osRelease[2]) >= 14931 ? 3 : 2;
      }
      return 1;
    }
    if ("CI" in env2) {
      if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI"].some(function(sign) {
        return sign in env2;
      }) || env2.CI_NAME === "codeship") {
        return 1;
      }
      return min;
    }
    if ("TEAMCITY_VERSION" in env2) {
      return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env2.TEAMCITY_VERSION) ? 1 : 0;
    }
    if ("TERM_PROGRAM" in env2) {
      var version = parseInt((env2.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
      switch (env2.TERM_PROGRAM) {
        case "iTerm.app":
          return version >= 3 ? 3 : 2;
        case "Hyper":
          return 3;
        case "Apple_Terminal":
          return 2;
      }
    }
    if (/-256(color)?$/i.test(env2.TERM)) {
      return 2;
    }
    if (/^screen|^xterm|^vt100|^rxvt|color|ansi|cygwin|linux/i.test(env2.TERM)) {
      return 1;
    }
    if ("COLORTERM" in env2) {
      return 1;
    }
    if (env2.TERM === "dumb") {
      return min;
    }
    return min;
  }
  function getSupportLevel(stream) {
    var level = supportsColor2(stream);
    return translateLevel2(level);
  }
  module.exports = {
    supportsColor: getSupportLevel,
    stdout: getSupportLevel(process.stdout),
    stderr: getSupportLevel(process.stderr)
  };
});

// node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/custom/trap.js
var require_trap = __commonJS((exports, module) => {
  module["exports"] = function runTheTrap(text, options) {
    var result = "";
    text = text || "Run the trap, drop the bass";
    text = text.split("");
    var trap = {
      a: ["@", "Ą", "Ⱥ", "Ʌ", "Δ", "Λ", "Д"],
      b: ["ß", "Ɓ", "Ƀ", "ɮ", "β", "฿"],
      c: ["©", "Ȼ", "Ͼ"],
      d: ["Ð", "Ɗ", "Ԁ", "ԁ", "Ԃ", "ԃ"],
      e: [
        "Ë",
        "ĕ",
        "Ǝ",
        "ɘ",
        "Σ",
        "ξ",
        "Ҽ",
        "੬"
      ],
      f: ["Ӻ"],
      g: ["ɢ"],
      h: ["Ħ", "ƕ", "Ң", "Һ", "Ӈ", "Ԋ"],
      i: ["༏"],
      j: ["Ĵ"],
      k: ["ĸ", "Ҡ", "Ӄ", "Ԟ"],
      l: ["Ĺ"],
      m: ["ʍ", "Ӎ", "ӎ", "Ԡ", "ԡ", "൩"],
      n: ["Ñ", "ŋ", "Ɲ", "Ͷ", "Π", "Ҋ"],
      o: [
        "Ø",
        "õ",
        "ø",
        "Ǿ",
        "ʘ",
        "Ѻ",
        "ם",
        "۝",
        "๏"
      ],
      p: ["Ƿ", "Ҏ"],
      q: ["্"],
      r: ["®", "Ʀ", "Ȑ", "Ɍ", "ʀ", "Я"],
      s: ["§", "Ϟ", "ϟ", "Ϩ"],
      t: ["Ł", "Ŧ", "ͳ"],
      u: ["Ʊ", "Ս"],
      v: ["ט"],
      w: ["Ш", "Ѡ", "Ѽ", "൰"],
      x: ["Ҳ", "Ӿ", "Ӽ", "ӽ"],
      y: ["¥", "Ұ", "Ӌ"],
      z: ["Ƶ", "ɀ"]
    };
    text.forEach(function(c) {
      c = c.toLowerCase();
      var chars = trap[c] || [" "];
      var rand = Math.floor(Math.random() * chars.length);
      if (typeof trap[c] !== "undefined") {
        result += trap[c][rand];
      } else {
        result += c;
      }
    });
    return result;
  };
});

// node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/custom/zalgo.js
var require_zalgo = __commonJS((exports, module) => {
  module["exports"] = function zalgo(text, options) {
    text = text || "   he is here   ";
    var soul = {
      up: [
        "̍",
        "̎",
        "̄",
        "̅",
        "̿",
        "̑",
        "̆",
        "̐",
        "͒",
        "͗",
        "͑",
        "̇",
        "̈",
        "̊",
        "͂",
        "̓",
        "̈",
        "͊",
        "͋",
        "͌",
        "̃",
        "̂",
        "̌",
        "͐",
        "̀",
        "́",
        "̋",
        "̏",
        "̒",
        "̓",
        "̔",
        "̽",
        "̉",
        "ͣ",
        "ͤ",
        "ͥ",
        "ͦ",
        "ͧ",
        "ͨ",
        "ͩ",
        "ͪ",
        "ͫ",
        "ͬ",
        "ͭ",
        "ͮ",
        "ͯ",
        "̾",
        "͛",
        "͆",
        "̚"
      ],
      down: [
        "̖",
        "̗",
        "̘",
        "̙",
        "̜",
        "̝",
        "̞",
        "̟",
        "̠",
        "̤",
        "̥",
        "̦",
        "̩",
        "̪",
        "̫",
        "̬",
        "̭",
        "̮",
        "̯",
        "̰",
        "̱",
        "̲",
        "̳",
        "̹",
        "̺",
        "̻",
        "̼",
        "ͅ",
        "͇",
        "͈",
        "͉",
        "͍",
        "͎",
        "͓",
        "͔",
        "͕",
        "͖",
        "͙",
        "͚",
        "̣"
      ],
      mid: [
        "̕",
        "̛",
        "̀",
        "́",
        "͘",
        "̡",
        "̢",
        "̧",
        "̨",
        "̴",
        "̵",
        "̶",
        "͜",
        "͝",
        "͞",
        "͟",
        "͠",
        "͢",
        "̸",
        "̷",
        "͡",
        " ҉"
      ]
    };
    var all = [].concat(soul.up, soul.down, soul.mid);
    function randomNumber(range) {
      var r = Math.floor(Math.random() * range);
      return r;
    }
    function isChar(character) {
      var bool = false;
      all.filter(function(i) {
        bool = i === character;
      });
      return bool;
    }
    function heComes(text2, options2) {
      var result = "";
      var counts;
      var l;
      options2 = options2 || {};
      options2["up"] = typeof options2["up"] !== "undefined" ? options2["up"] : true;
      options2["mid"] = typeof options2["mid"] !== "undefined" ? options2["mid"] : true;
      options2["down"] = typeof options2["down"] !== "undefined" ? options2["down"] : true;
      options2["size"] = typeof options2["size"] !== "undefined" ? options2["size"] : "maxi";
      text2 = text2.split("");
      for (l in text2) {
        if (isChar(l)) {
          continue;
        }
        result = result + text2[l];
        counts = { up: 0, down: 0, mid: 0 };
        switch (options2.size) {
          case "mini":
            counts.up = randomNumber(8);
            counts.mid = randomNumber(2);
            counts.down = randomNumber(8);
            break;
          case "maxi":
            counts.up = randomNumber(16) + 3;
            counts.mid = randomNumber(4) + 1;
            counts.down = randomNumber(64) + 3;
            break;
          default:
            counts.up = randomNumber(8) + 1;
            counts.mid = randomNumber(6) / 2;
            counts.down = randomNumber(8) + 1;
            break;
        }
        var arr = ["up", "mid", "down"];
        for (var d in arr) {
          var index = arr[d];
          for (var i = 0;i <= counts[index]; i++) {
            if (options2[index]) {
              result = result + soul[index][randomNumber(soul[index].length)];
            }
          }
        }
      }
      return result;
    }
    return heComes(text, options);
  };
});

// node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/america.js
var require_america = __commonJS((exports, module) => {
  module["exports"] = function(colors) {
    return function(letter, i, exploded) {
      if (letter === " ")
        return letter;
      switch (i % 3) {
        case 0:
          return colors.red(letter);
        case 1:
          return colors.white(letter);
        case 2:
          return colors.blue(letter);
      }
    };
  };
});

// node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/zebra.js
var require_zebra = __commonJS((exports, module) => {
  module["exports"] = function(colors) {
    return function(letter, i, exploded) {
      return i % 2 === 0 ? letter : colors.inverse(letter);
    };
  };
});

// node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/rainbow.js
var require_rainbow = __commonJS((exports, module) => {
  module["exports"] = function(colors) {
    var rainbowColors = ["red", "yellow", "green", "blue", "magenta"];
    return function(letter, i, exploded) {
      if (letter === " ") {
        return letter;
      } else {
        return colors[rainbowColors[i++ % rainbowColors.length]](letter);
      }
    };
  };
});

// node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/random.js
var require_random = __commonJS((exports, module) => {
  module["exports"] = function(colors) {
    var available = [
      "underline",
      "inverse",
      "grey",
      "yellow",
      "red",
      "green",
      "blue",
      "white",
      "cyan",
      "magenta",
      "brightYellow",
      "brightRed",
      "brightGreen",
      "brightBlue",
      "brightWhite",
      "brightCyan",
      "brightMagenta"
    ];
    return function(letter, i, exploded) {
      return letter === " " ? letter : colors[available[Math.round(Math.random() * (available.length - 2))]](letter);
    };
  };
});

// node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/colors.js
var require_colors = __commonJS((exports, module) => {
  var colors = {};
  module["exports"] = colors;
  colors.themes = {};
  var util = __require("util");
  var ansiStyles2 = colors.styles = require_styles();
  var defineProps = Object.defineProperties;
  var newLineRegex = new RegExp(/[\r\n]+/g);
  colors.supportsColor = require_supports_colors().supportsColor;
  if (typeof colors.enabled === "undefined") {
    colors.enabled = colors.supportsColor() !== false;
  }
  colors.enable = function() {
    colors.enabled = true;
  };
  colors.disable = function() {
    colors.enabled = false;
  };
  colors.stripColors = colors.strip = function(str) {
    return ("" + str).replace(/\x1B\[\d+m/g, "");
  };
  var stylize = colors.stylize = function stylize(str, style) {
    if (!colors.enabled) {
      return str + "";
    }
    var styleMap = ansiStyles2[style];
    if (!styleMap && style in colors) {
      return colors[style](str);
    }
    return styleMap.open + str + styleMap.close;
  };
  var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
  var escapeStringRegexp = function(str) {
    if (typeof str !== "string") {
      throw new TypeError("Expected a string");
    }
    return str.replace(matchOperatorsRe, "\\$&");
  };
  function build(_styles) {
    var builder = function builder() {
      return applyStyle3.apply(builder, arguments);
    };
    builder._styles = _styles;
    builder.__proto__ = proto3;
    return builder;
  }
  var styles4 = function() {
    var ret = {};
    ansiStyles2.grey = ansiStyles2.gray;
    Object.keys(ansiStyles2).forEach(function(key) {
      ansiStyles2[key].closeRe = new RegExp(escapeStringRegexp(ansiStyles2[key].close), "g");
      ret[key] = {
        get: function() {
          return build(this._styles.concat(key));
        }
      };
    });
    return ret;
  }();
  var proto3 = defineProps(function colors() {}, styles4);
  function applyStyle3() {
    var args = Array.prototype.slice.call(arguments);
    var str = args.map(function(arg) {
      if (arg != null && arg.constructor === String) {
        return arg;
      } else {
        return util.inspect(arg);
      }
    }).join(" ");
    if (!colors.enabled || !str) {
      return str;
    }
    var newLinesPresent = str.indexOf(`
`) != -1;
    var nestedStyles = this._styles;
    var i = nestedStyles.length;
    while (i--) {
      var code = ansiStyles2[nestedStyles[i]];
      str = code.open + str.replace(code.closeRe, code.open) + code.close;
      if (newLinesPresent) {
        str = str.replace(newLineRegex, function(match) {
          return code.close + match + code.open;
        });
      }
    }
    return str;
  }
  colors.setTheme = function(theme) {
    if (typeof theme === "string") {
      console.log("colors.setTheme now only accepts an object, not a string.  " + "If you are trying to set a theme from a file, it is now your (the " + "caller's) responsibility to require the file.  The old syntax " + "looked like colors.setTheme(__dirname + " + "'/../themes/generic-logging.js'); The new syntax looks like " + "colors.setTheme(require(__dirname + " + "'/../themes/generic-logging.js'));");
      return;
    }
    for (var style in theme) {
      (function(style2) {
        colors[style2] = function(str) {
          if (typeof theme[style2] === "object") {
            var out = str;
            for (var i in theme[style2]) {
              out = colors[theme[style2][i]](out);
            }
            return out;
          }
          return colors[theme[style2]](str);
        };
      })(style);
    }
  };
  function init() {
    var ret = {};
    Object.keys(styles4).forEach(function(name) {
      ret[name] = {
        get: function() {
          return build([name]);
        }
      };
    });
    return ret;
  }
  var sequencer = function sequencer(map2, str) {
    var exploded = str.split("");
    exploded = exploded.map(map2);
    return exploded.join("");
  };
  colors.trap = require_trap();
  colors.zalgo = require_zalgo();
  colors.maps = {};
  colors.maps.america = require_america()(colors);
  colors.maps.zebra = require_zebra()(colors);
  colors.maps.rainbow = require_rainbow()(colors);
  colors.maps.random = require_random()(colors);
  for (map in colors.maps) {
    (function(map2) {
      colors[map2] = function(str) {
        return sequencer(colors.maps[map2], str);
      };
    })(map);
  }
  var map;
  defineProps(colors, init());
});

// node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/safe.js
var require_safe = __commonJS((exports, module) => {
  var colors = require_colors();
  module["exports"] = colors;
});

// node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/cell.js
var require_cell = __commonJS((exports, module) => {
  var { info, debug } = require_debug();
  var utils = require_utils();

  class Cell {
    constructor(options) {
      this.setOptions(options);
      this.x = null;
      this.y = null;
    }
    setOptions(options) {
      if (["boolean", "number", "bigint", "string"].indexOf(typeof options) !== -1) {
        options = { content: "" + options };
      }
      options = options || {};
      this.options = options;
      let content = options.content;
      if (["boolean", "number", "bigint", "string"].indexOf(typeof content) !== -1) {
        this.content = String(content);
      } else if (!content) {
        this.content = this.options.href || "";
      } else {
        throw new Error("Content needs to be a primitive, got: " + typeof content);
      }
      this.colSpan = options.colSpan || 1;
      this.rowSpan = options.rowSpan || 1;
      if (this.options.href) {
        Object.defineProperty(this, "href", {
          get() {
            return this.options.href;
          }
        });
      }
    }
    mergeTableOptions(tableOptions, cells) {
      this.cells = cells;
      let optionsChars = this.options.chars || {};
      let tableChars = tableOptions.chars;
      let chars = this.chars = {};
      CHAR_NAMES.forEach(function(name) {
        setOption(optionsChars, tableChars, name, chars);
      });
      this.truncate = this.options.truncate || tableOptions.truncate;
      let style = this.options.style = this.options.style || {};
      let tableStyle = tableOptions.style;
      setOption(style, tableStyle, "padding-left", this);
      setOption(style, tableStyle, "padding-right", this);
      this.head = style.head || tableStyle.head;
      this.border = style.border || tableStyle.border;
      this.fixedWidth = tableOptions.colWidths[this.x];
      this.lines = this.computeLines(tableOptions);
      this.desiredWidth = utils.strlen(this.content) + this.paddingLeft + this.paddingRight;
      this.desiredHeight = this.lines.length;
    }
    computeLines(tableOptions) {
      const tableWordWrap = tableOptions.wordWrap || tableOptions.textWrap;
      const { wordWrap = tableWordWrap } = this.options;
      if (this.fixedWidth && wordWrap) {
        this.fixedWidth -= this.paddingLeft + this.paddingRight;
        if (this.colSpan) {
          let i = 1;
          while (i < this.colSpan) {
            this.fixedWidth += tableOptions.colWidths[this.x + i];
            i++;
          }
        }
        const { wrapOnWordBoundary: tableWrapOnWordBoundary = true } = tableOptions;
        const { wrapOnWordBoundary = tableWrapOnWordBoundary } = this.options;
        return this.wrapLines(utils.wordWrap(this.fixedWidth, this.content, wrapOnWordBoundary));
      }
      return this.wrapLines(this.content.split(`
`));
    }
    wrapLines(computedLines) {
      const lines = utils.colorizeLines(computedLines);
      if (this.href) {
        return lines.map((line) => utils.hyperlink(this.href, line));
      }
      return lines;
    }
    init(tableOptions) {
      let x = this.x;
      let y = this.y;
      this.widths = tableOptions.colWidths.slice(x, x + this.colSpan);
      this.heights = tableOptions.rowHeights.slice(y, y + this.rowSpan);
      this.width = this.widths.reduce(sumPlusOne, -1);
      this.height = this.heights.reduce(sumPlusOne, -1);
      this.hAlign = this.options.hAlign || tableOptions.colAligns[x];
      this.vAlign = this.options.vAlign || tableOptions.rowAligns[y];
      this.drawRight = x + this.colSpan == tableOptions.colWidths.length;
    }
    draw(lineNum, spanningCell) {
      if (lineNum == "top")
        return this.drawTop(this.drawRight);
      if (lineNum == "bottom")
        return this.drawBottom(this.drawRight);
      let content = utils.truncate(this.content, 10, this.truncate);
      if (!lineNum) {
        info(`${this.y}-${this.x}: ${this.rowSpan - lineNum}x${this.colSpan} Cell ${content}`);
      } else {}
      let padLen = Math.max(this.height - this.lines.length, 0);
      let padTop;
      switch (this.vAlign) {
        case "center":
          padTop = Math.ceil(padLen / 2);
          break;
        case "bottom":
          padTop = padLen;
          break;
        default:
          padTop = 0;
      }
      if (lineNum < padTop || lineNum >= padTop + this.lines.length) {
        return this.drawEmpty(this.drawRight, spanningCell);
      }
      let forceTruncation = this.lines.length > this.height && lineNum + 1 >= this.height;
      return this.drawLine(lineNum - padTop, this.drawRight, forceTruncation, spanningCell);
    }
    drawTop(drawRight) {
      let content = [];
      if (this.cells) {
        this.widths.forEach(function(width, index) {
          content.push(this._topLeftChar(index));
          content.push(utils.repeat(this.chars[this.y == 0 ? "top" : "mid"], width));
        }, this);
      } else {
        content.push(this._topLeftChar(0));
        content.push(utils.repeat(this.chars[this.y == 0 ? "top" : "mid"], this.width));
      }
      if (drawRight) {
        content.push(this.chars[this.y == 0 ? "topRight" : "rightMid"]);
      }
      return this.wrapWithStyleColors("border", content.join(""));
    }
    _topLeftChar(offset) {
      let x = this.x + offset;
      let leftChar;
      if (this.y == 0) {
        leftChar = x == 0 ? "topLeft" : offset == 0 ? "topMid" : "top";
      } else {
        if (x == 0) {
          leftChar = "leftMid";
        } else {
          leftChar = offset == 0 ? "midMid" : "bottomMid";
          if (this.cells) {
            let spanAbove = this.cells[this.y - 1][x] instanceof Cell.ColSpanCell;
            if (spanAbove) {
              leftChar = offset == 0 ? "topMid" : "mid";
            }
            if (offset == 0) {
              let i = 1;
              while (this.cells[this.y][x - i] instanceof Cell.ColSpanCell) {
                i++;
              }
              if (this.cells[this.y][x - i] instanceof Cell.RowSpanCell) {
                leftChar = "leftMid";
              }
            }
          }
        }
      }
      return this.chars[leftChar];
    }
    wrapWithStyleColors(styleProperty, content) {
      if (this[styleProperty] && this[styleProperty].length) {
        try {
          let colors = require_safe();
          for (let i = this[styleProperty].length - 1;i >= 0; i--) {
            colors = colors[this[styleProperty][i]];
          }
          return colors(content);
        } catch (e) {
          return content;
        }
      } else {
        return content;
      }
    }
    drawLine(lineNum, drawRight, forceTruncationSymbol, spanningCell) {
      let left = this.chars[this.x == 0 ? "left" : "middle"];
      if (this.x && spanningCell && this.cells) {
        let cellLeft = this.cells[this.y + spanningCell][this.x - 1];
        while (cellLeft instanceof ColSpanCell) {
          cellLeft = this.cells[cellLeft.y][cellLeft.x - 1];
        }
        if (!(cellLeft instanceof RowSpanCell)) {
          left = this.chars["rightMid"];
        }
      }
      let leftPadding = utils.repeat(" ", this.paddingLeft);
      let right = drawRight ? this.chars["right"] : "";
      let rightPadding = utils.repeat(" ", this.paddingRight);
      let line = this.lines[lineNum];
      let len = this.width - (this.paddingLeft + this.paddingRight);
      if (forceTruncationSymbol)
        line += this.truncate || "…";
      let content = utils.truncate(line, len, this.truncate);
      content = utils.pad(content, len, " ", this.hAlign);
      content = leftPadding + content + rightPadding;
      return this.stylizeLine(left, content, right);
    }
    stylizeLine(left, content, right) {
      left = this.wrapWithStyleColors("border", left);
      right = this.wrapWithStyleColors("border", right);
      if (this.y === 0) {
        content = this.wrapWithStyleColors("head", content);
      }
      return left + content + right;
    }
    drawBottom(drawRight) {
      let left = this.chars[this.x == 0 ? "bottomLeft" : "bottomMid"];
      let content = utils.repeat(this.chars.bottom, this.width);
      let right = drawRight ? this.chars["bottomRight"] : "";
      return this.wrapWithStyleColors("border", left + content + right);
    }
    drawEmpty(drawRight, spanningCell) {
      let left = this.chars[this.x == 0 ? "left" : "middle"];
      if (this.x && spanningCell && this.cells) {
        let cellLeft = this.cells[this.y + spanningCell][this.x - 1];
        while (cellLeft instanceof ColSpanCell) {
          cellLeft = this.cells[cellLeft.y][cellLeft.x - 1];
        }
        if (!(cellLeft instanceof RowSpanCell)) {
          left = this.chars["rightMid"];
        }
      }
      let right = drawRight ? this.chars["right"] : "";
      let content = utils.repeat(" ", this.width);
      return this.stylizeLine(left, content, right);
    }
  }

  class ColSpanCell {
    constructor() {}
    draw(lineNum) {
      if (typeof lineNum === "number") {
        debug(`${this.y}-${this.x}: 1x1 ColSpanCell`);
      }
      return "";
    }
    init() {}
    mergeTableOptions() {}
  }

  class RowSpanCell {
    constructor(originalCell) {
      this.originalCell = originalCell;
    }
    init(tableOptions) {
      let y = this.y;
      let originalY = this.originalCell.y;
      this.cellOffset = y - originalY;
      this.offset = findDimension(tableOptions.rowHeights, originalY, this.cellOffset);
    }
    draw(lineNum) {
      if (lineNum == "top") {
        return this.originalCell.draw(this.offset, this.cellOffset);
      }
      if (lineNum == "bottom") {
        return this.originalCell.draw("bottom");
      }
      debug(`${this.y}-${this.x}: 1x${this.colSpan} RowSpanCell for ${this.originalCell.content}`);
      return this.originalCell.draw(this.offset + 1 + lineNum);
    }
    mergeTableOptions() {}
  }
  function firstDefined(...args) {
    return args.filter((v) => v !== undefined && v !== null).shift();
  }
  function setOption(objA, objB, nameB, targetObj) {
    let nameA = nameB.split("-");
    if (nameA.length > 1) {
      nameA[1] = nameA[1].charAt(0).toUpperCase() + nameA[1].substr(1);
      nameA = nameA.join("");
      targetObj[nameA] = firstDefined(objA[nameA], objA[nameB], objB[nameA], objB[nameB]);
    } else {
      targetObj[nameB] = firstDefined(objA[nameB], objB[nameB]);
    }
  }
  function findDimension(dimensionTable, startingIndex, span) {
    let ret = dimensionTable[startingIndex];
    for (let i = 1;i < span; i++) {
      ret += 1 + dimensionTable[startingIndex + i];
    }
    return ret;
  }
  function sumPlusOne(a, b) {
    return a + b + 1;
  }
  var CHAR_NAMES = [
    "top",
    "top-mid",
    "top-left",
    "top-right",
    "bottom",
    "bottom-mid",
    "bottom-left",
    "bottom-right",
    "left",
    "left-mid",
    "mid",
    "mid-mid",
    "right",
    "right-mid",
    "middle"
  ];
  module.exports = Cell;
  module.exports.ColSpanCell = ColSpanCell;
  module.exports.RowSpanCell = RowSpanCell;
});

// node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/layout-manager.js
var require_layout_manager = __commonJS((exports, module) => {
  var { warn, debug } = require_debug();
  var Cell = require_cell();
  var { ColSpanCell, RowSpanCell } = Cell;
  (function() {
    function next(alloc, col) {
      if (alloc[col] > 0) {
        return next(alloc, col + 1);
      }
      return col;
    }
    function layoutTable(table) {
      let alloc = {};
      table.forEach(function(row, rowIndex) {
        let col = 0;
        row.forEach(function(cell) {
          cell.y = rowIndex;
          cell.x = rowIndex ? next(alloc, col) : col;
          const rowSpan = cell.rowSpan || 1;
          const colSpan = cell.colSpan || 1;
          if (rowSpan > 1) {
            for (let cs = 0;cs < colSpan; cs++) {
              alloc[cell.x + cs] = rowSpan;
            }
          }
          col = cell.x + colSpan;
        });
        Object.keys(alloc).forEach((idx) => {
          alloc[idx]--;
          if (alloc[idx] < 1)
            delete alloc[idx];
        });
      });
    }
    function maxWidth(table) {
      let mw = 0;
      table.forEach(function(row) {
        row.forEach(function(cell) {
          mw = Math.max(mw, cell.x + (cell.colSpan || 1));
        });
      });
      return mw;
    }
    function maxHeight(table) {
      return table.length;
    }
    function cellsConflict(cell1, cell2) {
      let yMin1 = cell1.y;
      let yMax1 = cell1.y - 1 + (cell1.rowSpan || 1);
      let yMin2 = cell2.y;
      let yMax2 = cell2.y - 1 + (cell2.rowSpan || 1);
      let yConflict = !(yMin1 > yMax2 || yMin2 > yMax1);
      let xMin1 = cell1.x;
      let xMax1 = cell1.x - 1 + (cell1.colSpan || 1);
      let xMin2 = cell2.x;
      let xMax2 = cell2.x - 1 + (cell2.colSpan || 1);
      let xConflict = !(xMin1 > xMax2 || xMin2 > xMax1);
      return yConflict && xConflict;
    }
    function conflictExists(rows, x, y) {
      let i_max = Math.min(rows.length - 1, y);
      let cell = { x, y };
      for (let i = 0;i <= i_max; i++) {
        let row = rows[i];
        for (let j = 0;j < row.length; j++) {
          if (cellsConflict(cell, row[j])) {
            return true;
          }
        }
      }
      return false;
    }
    function allBlank(rows, y, xMin, xMax) {
      for (let x = xMin;x < xMax; x++) {
        if (conflictExists(rows, x, y)) {
          return false;
        }
      }
      return true;
    }
    function addRowSpanCells(table) {
      table.forEach(function(row, rowIndex) {
        row.forEach(function(cell) {
          for (let i = 1;i < cell.rowSpan; i++) {
            let rowSpanCell = new RowSpanCell(cell);
            rowSpanCell.x = cell.x;
            rowSpanCell.y = cell.y + i;
            rowSpanCell.colSpan = cell.colSpan;
            insertCell(rowSpanCell, table[rowIndex + i]);
          }
        });
      });
    }
    function addColSpanCells(cellRows) {
      for (let rowIndex = cellRows.length - 1;rowIndex >= 0; rowIndex--) {
        let cellColumns = cellRows[rowIndex];
        for (let columnIndex = 0;columnIndex < cellColumns.length; columnIndex++) {
          let cell = cellColumns[columnIndex];
          for (let k = 1;k < cell.colSpan; k++) {
            let colSpanCell = new ColSpanCell;
            colSpanCell.x = cell.x + k;
            colSpanCell.y = cell.y;
            cellColumns.splice(columnIndex + 1, 0, colSpanCell);
          }
        }
      }
    }
    function insertCell(cell, row) {
      let x = 0;
      while (x < row.length && row[x].x < cell.x) {
        x++;
      }
      row.splice(x, 0, cell);
    }
    function fillInTable(table) {
      let h_max = maxHeight(table);
      let w_max = maxWidth(table);
      debug(`Max rows: ${h_max}; Max cols: ${w_max}`);
      for (let y = 0;y < h_max; y++) {
        for (let x = 0;x < w_max; x++) {
          if (!conflictExists(table, x, y)) {
            let opts = { x, y, colSpan: 1, rowSpan: 1 };
            x++;
            while (x < w_max && !conflictExists(table, x, y)) {
              opts.colSpan++;
              x++;
            }
            let y2 = y + 1;
            while (y2 < h_max && allBlank(table, y2, opts.x, opts.x + opts.colSpan)) {
              opts.rowSpan++;
              y2++;
            }
            let cell = new Cell(opts);
            cell.x = opts.x;
            cell.y = opts.y;
            warn(`Missing cell at ${cell.y}-${cell.x}.`);
            insertCell(cell, table[y]);
          }
        }
      }
    }
    function generateCells(rows) {
      return rows.map(function(row) {
        if (!Array.isArray(row)) {
          let key = Object.keys(row)[0];
          row = row[key];
          if (Array.isArray(row)) {
            row = row.slice();
            row.unshift(key);
          } else {
            row = [key, row];
          }
        }
        return row.map(function(cell) {
          return new Cell(cell);
        });
      });
    }
    function makeTableLayout(rows) {
      let cellRows = generateCells(rows);
      layoutTable(cellRows);
      fillInTable(cellRows);
      addRowSpanCells(cellRows);
      addColSpanCells(cellRows);
      return cellRows;
    }
    module.exports = {
      makeTableLayout,
      layoutTable,
      addRowSpanCells,
      maxWidth,
      fillInTable,
      computeWidths: makeComputeWidths("colSpan", "desiredWidth", "x", 1),
      computeHeights: makeComputeWidths("rowSpan", "desiredHeight", "y", 1)
    };
  })();
  function makeComputeWidths(colSpan, desiredWidth, x, forcedMin) {
    return function(vals, table) {
      let result = [];
      let spanners = [];
      let auto = {};
      table.forEach(function(row) {
        row.forEach(function(cell) {
          if ((cell[colSpan] || 1) > 1) {
            spanners.push(cell);
          } else {
            result[cell[x]] = Math.max(result[cell[x]] || 0, cell[desiredWidth] || 0, forcedMin);
          }
        });
      });
      vals.forEach(function(val, index) {
        if (typeof val === "number") {
          result[index] = val;
        }
      });
      for (let k = spanners.length - 1;k >= 0; k--) {
        let cell = spanners[k];
        let span = cell[colSpan];
        let col = cell[x];
        let existingWidth = result[col];
        let editableCols = typeof vals[col] === "number" ? 0 : 1;
        if (typeof existingWidth === "number") {
          for (let i = 1;i < span; i++) {
            existingWidth += 1 + result[col + i];
            if (typeof vals[col + i] !== "number") {
              editableCols++;
            }
          }
        } else {
          existingWidth = desiredWidth === "desiredWidth" ? cell.desiredWidth - 1 : 1;
          if (!auto[col] || auto[col] < existingWidth) {
            auto[col] = existingWidth;
          }
        }
        if (cell[desiredWidth] > existingWidth) {
          let i = 0;
          while (editableCols > 0 && cell[desiredWidth] > existingWidth) {
            if (typeof vals[col + i] !== "number") {
              let dif = Math.round((cell[desiredWidth] - existingWidth) / editableCols);
              existingWidth += dif;
              result[col + i] += dif;
              editableCols--;
            }
            i++;
          }
        }
      }
      Object.assign(vals, result, auto);
      for (let j = 0;j < vals.length; j++) {
        vals[j] = Math.max(forcedMin, vals[j] || 0);
      }
    };
  }
});

// node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/table.js
var require_table = __commonJS((exports, module) => {
  var debug = require_debug();
  var utils = require_utils();
  var tableLayout = require_layout_manager();

  class Table extends Array {
    constructor(opts) {
      super();
      const options = utils.mergeOptions(opts);
      Object.defineProperty(this, "options", {
        value: options,
        enumerable: options.debug
      });
      if (options.debug) {
        switch (typeof options.debug) {
          case "boolean":
            debug.setDebugLevel(debug.WARN);
            break;
          case "number":
            debug.setDebugLevel(options.debug);
            break;
          case "string":
            debug.setDebugLevel(parseInt(options.debug, 10));
            break;
          default:
            debug.setDebugLevel(debug.WARN);
            debug.warn(`Debug option is expected to be boolean, number, or string. Received a ${typeof options.debug}`);
        }
        Object.defineProperty(this, "messages", {
          get() {
            return debug.debugMessages();
          }
        });
      }
    }
    toString() {
      let array = this;
      let headersPresent = this.options.head && this.options.head.length;
      if (headersPresent) {
        array = [this.options.head];
        if (this.length) {
          array.push.apply(array, this);
        }
      } else {
        this.options.style.head = [];
      }
      let cells = tableLayout.makeTableLayout(array);
      cells.forEach(function(row) {
        row.forEach(function(cell) {
          cell.mergeTableOptions(this.options, cells);
        }, this);
      }, this);
      tableLayout.computeWidths(this.options.colWidths, cells);
      tableLayout.computeHeights(this.options.rowHeights, cells);
      cells.forEach(function(row) {
        row.forEach(function(cell) {
          cell.init(this.options);
        }, this);
      }, this);
      let result = [];
      for (let rowIndex = 0;rowIndex < cells.length; rowIndex++) {
        let row = cells[rowIndex];
        let heightOfRow = this.options.rowHeights[rowIndex];
        if (rowIndex === 0 || !this.options.style.compact || rowIndex == 1 && headersPresent) {
          doDraw(row, "top", result);
        }
        for (let lineNum = 0;lineNum < heightOfRow; lineNum++) {
          doDraw(row, lineNum, result);
        }
        if (rowIndex + 1 == cells.length) {
          doDraw(row, "bottom", result);
        }
      }
      return result.join(`
`);
    }
    get width() {
      let str = this.toString().split(`
`);
      return str[0].length;
    }
  }
  Table.reset = () => debug.reset();
  function doDraw(row, lineNum, result) {
    let line = [];
    row.forEach(function(cell) {
      line.push(cell.draw(lineNum));
    });
    let str = line.join("");
    if (str.length)
      result.push(str);
  }
  module.exports = Table;
});

// node_modules/chalk/source/vendor/ansi-styles/index.js
var ANSI_BACKGROUND_OFFSET = 10;
var wrapAnsi16 = (offset = 0) => (code) => `\x1B[${code + offset}m`;
var wrapAnsi256 = (offset = 0) => (code) => `\x1B[${38 + offset};5;${code}m`;
var wrapAnsi16m = (offset = 0) => (red, green, blue) => `\x1B[${38 + offset};2;${red};${green};${blue}m`;
var styles = {
  modifier: {
    reset: [0, 0],
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29]
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    blackBright: [90, 39],
    gray: [90, 39],
    grey: [90, 39],
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39]
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    bgBlackBright: [100, 49],
    bgGray: [100, 49],
    bgGrey: [100, 49],
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49]
  }
};
var modifierNames = Object.keys(styles.modifier);
var foregroundColorNames = Object.keys(styles.color);
var backgroundColorNames = Object.keys(styles.bgColor);
var colorNames = [...foregroundColorNames, ...backgroundColorNames];
function assembleStyles() {
  const codes = new Map;
  for (const [groupName, group] of Object.entries(styles)) {
    for (const [styleName, style] of Object.entries(group)) {
      styles[styleName] = {
        open: `\x1B[${style[0]}m`,
        close: `\x1B[${style[1]}m`
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }
    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false
    });
  }
  Object.defineProperty(styles, "codes", {
    value: codes,
    enumerable: false
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  styles.color.ansi = wrapAnsi16();
  styles.color.ansi256 = wrapAnsi256();
  styles.color.ansi16m = wrapAnsi16m();
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
  Object.defineProperties(styles, {
    rgbToAnsi256: {
      value(red, green, blue) {
        if (red === green && green === blue) {
          if (red < 8) {
            return 16;
          }
          if (red > 248) {
            return 231;
          }
          return Math.round((red - 8) / 247 * 24) + 232;
        }
        return 16 + 36 * Math.round(red / 255 * 5) + 6 * Math.round(green / 255 * 5) + Math.round(blue / 255 * 5);
      },
      enumerable: false
    },
    hexToRgb: {
      value(hex) {
        const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
        if (!matches) {
          return [0, 0, 0];
        }
        let [colorString] = matches;
        if (colorString.length === 3) {
          colorString = [...colorString].map((character) => character + character).join("");
        }
        const integer = Number.parseInt(colorString, 16);
        return [
          integer >> 16 & 255,
          integer >> 8 & 255,
          integer & 255
        ];
      },
      enumerable: false
    },
    hexToAnsi256: {
      value: (hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)),
      enumerable: false
    },
    ansi256ToAnsi: {
      value(code) {
        if (code < 8) {
          return 30 + code;
        }
        if (code < 16) {
          return 90 + (code - 8);
        }
        let red;
        let green;
        let blue;
        if (code >= 232) {
          red = ((code - 232) * 10 + 8) / 255;
          green = red;
          blue = red;
        } else {
          code -= 16;
          const remainder = code % 36;
          red = Math.floor(code / 36) / 5;
          green = Math.floor(remainder / 6) / 5;
          blue = remainder % 6 / 5;
        }
        const value = Math.max(red, green, blue) * 2;
        if (value === 0) {
          return 30;
        }
        let result = 30 + (Math.round(blue) << 2 | Math.round(green) << 1 | Math.round(red));
        if (value === 2) {
          result += 60;
        }
        return result;
      },
      enumerable: false
    },
    rgbToAnsi: {
      value: (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
      enumerable: false
    },
    hexToAnsi: {
      value: (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
      enumerable: false
    }
  });
  return styles;
}
var ansiStyles = assembleStyles();
var ansi_styles_default = ansiStyles;

// node_modules/chalk/source/vendor/supports-color/index.js
import process2 from "node:process";
import os from "node:os";
import tty from "node:tty";
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process2.argv) {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf("--");
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}
var { env } = process2;
var flagForceColor;
if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
  flagForceColor = 0;
} else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
  flagForceColor = 1;
}
function envForceColor() {
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      return 1;
    }
    if (env.FORCE_COLOR === "false") {
      return 0;
    }
    return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
  }
}
function translateLevel(level) {
  if (level === 0) {
    return false;
  }
  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3
  };
}
function _supportsColor(haveStream, { streamIsTTY, sniffFlags = true } = {}) {
  const noFlagForceColor = envForceColor();
  if (noFlagForceColor !== undefined) {
    flagForceColor = noFlagForceColor;
  }
  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;
  if (forceColor === 0) {
    return 0;
  }
  if (sniffFlags) {
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }
    if (hasFlag("color=256")) {
      return 2;
    }
  }
  if ("TF_BUILD" in env && "AGENT_NAME" in env) {
    return 1;
  }
  if (haveStream && !streamIsTTY && forceColor === undefined) {
    return 0;
  }
  const min = forceColor || 0;
  if (env.TERM === "dumb") {
    return min;
  }
  if (process2.platform === "win32") {
    const osRelease = os.release().split(".");
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }
    return 1;
  }
  if ("CI" in env) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => (key in env))) {
      return 3;
    }
    if (["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => (sign in env)) || env.CI_NAME === "codeship") {
      return 1;
    }
    return min;
  }
  if ("TEAMCITY_VERSION" in env) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  }
  if (env.COLORTERM === "truecolor") {
    return 3;
  }
  if (env.TERM === "xterm-kitty") {
    return 3;
  }
  if (env.TERM === "xterm-ghostty") {
    return 3;
  }
  if (env.TERM === "wezterm") {
    return 3;
  }
  if ("TERM_PROGRAM" in env) {
    const version = Number.parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
    switch (env.TERM_PROGRAM) {
      case "iTerm.app": {
        return version >= 3 ? 3 : 2;
      }
      case "Apple_Terminal": {
        return 2;
      }
    }
  }
  if (/-256(color)?$/i.test(env.TERM)) {
    return 2;
  }
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1;
  }
  if ("COLORTERM" in env) {
    return 1;
  }
  return min;
}
function createSupportsColor(stream, options = {}) {
  const level = _supportsColor(stream, {
    streamIsTTY: stream && stream.isTTY,
    ...options
  });
  return translateLevel(level);
}
var supportsColor = {
  stdout: createSupportsColor({ isTTY: tty.isatty(1) }),
  stderr: createSupportsColor({ isTTY: tty.isatty(2) })
};
var supports_color_default = supportsColor;

// node_modules/chalk/source/utilities.js
function stringReplaceAll(string, substring, replacer) {
  let index = string.indexOf(substring);
  if (index === -1) {
    return string;
  }
  const substringLength = substring.length;
  let endIndex = 0;
  let returnValue = "";
  do {
    returnValue += string.slice(endIndex, index) + substring + replacer;
    endIndex = index + substringLength;
    index = string.indexOf(substring, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
  let endIndex = 0;
  let returnValue = "";
  do {
    const gotCR = string[index - 1] === "\r";
    returnValue += string.slice(endIndex, gotCR ? index - 1 : index) + prefix + (gotCR ? `\r
` : `
`) + postfix;
    endIndex = index + 1;
    index = string.indexOf(`
`, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}

// node_modules/chalk/source/index.js
var { stdout: stdoutColor, stderr: stderrColor } = supports_color_default;
var GENERATOR = Symbol("GENERATOR");
var STYLER = Symbol("STYLER");
var IS_EMPTY = Symbol("IS_EMPTY");
var levelMapping = [
  "ansi",
  "ansi",
  "ansi256",
  "ansi16m"
];
var styles2 = Object.create(null);
var applyOptions = (object, options = {}) => {
  if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === undefined ? colorLevel : options.level;
};
var chalkFactory = (options) => {
  const chalk = (...strings) => strings.join(" ");
  applyOptions(chalk, options);
  Object.setPrototypeOf(chalk, createChalk.prototype);
  return chalk;
};
function createChalk(options) {
  return chalkFactory(options);
}
Object.setPrototypeOf(createChalk.prototype, Function.prototype);
for (const [styleName, style] of Object.entries(ansi_styles_default)) {
  styles2[styleName] = {
    get() {
      const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
      Object.defineProperty(this, styleName, { value: builder });
      return builder;
    }
  };
}
styles2.visible = {
  get() {
    const builder = createBuilder(this, this[STYLER], true);
    Object.defineProperty(this, "visible", { value: builder });
    return builder;
  }
};
var getModelAnsi = (model, level, type, ...arguments_) => {
  if (model === "rgb") {
    if (level === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model === "hex") {
    return getModelAnsi("rgb", level, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model](...arguments_);
};
var usedModels = ["rgb", "hex", "ansi256"];
for (const model of usedModels) {
  styles2[model] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level], "color", ...arguments_), ansi_styles_default.color.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
  const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
  styles2[bgModel] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level], "bgColor", ...arguments_), ansi_styles_default.bgColor.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
}
var proto = Object.defineProperties(() => {}, {
  ...styles2,
  level: {
    enumerable: true,
    get() {
      return this[GENERATOR].level;
    },
    set(level) {
      this[GENERATOR].level = level;
    }
  }
});
var createStyler = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === undefined) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent
  };
};
var createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) => applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
};
var applyStyle = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }
  let styler = self[STYLER];
  if (styler === undefined) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== undefined) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf(`
`);
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
};
Object.defineProperties(createChalk.prototype, styles2);
var chalk = createChalk();
var chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
var source_default = chalk;

// node_modules/commander/esm.mjs
var import__ = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  Command,
  Argument,
  Option,
  Help
} = import__.default;
// package.json
var package_default = {
  name: "@steipete/bslog",
  version: "1.5.0",
  description: "Better Stack log query CLI with GraphQL-inspired syntax",
  keywords: [
    "betterstack",
    "cli",
    "graphql",
    "logging",
    "logs",
    "query"
  ],
  homepage: "https://github.com/steipete/bslog#readme",
  bugs: {
    url: "https://github.com/steipete/bslog/issues"
  },
  license: "MIT",
  author: "steipete",
  repository: {
    type: "git",
    url: "git+https://github.com/steipete/bslog.git"
  },
  bin: {
    bslog: "dist/index.js"
  },
  directories: {
    doc: "docs"
  },
  files: [
    "dist/index.js",
    "README.md"
  ],
  type: "module",
  main: "dist/index.js",
  scripts: {
    dev: "bun run src/index.ts",
    build: "bun build ./src/index.ts --compile --outfile dist/bslog",
    "build:npm": "bun build ./src/index.ts --target node --outfile dist/index.js && chmod +x dist/index.js",
    "build:all": "bun run build && bun run build:npm",
    test: "bun test --max-concurrency=1 src/__tests__/unit/config.test.ts && bun test --max-concurrency=1 src/__tests__/unit/client-simple.test.ts src/__tests__/unit/formatter.test.ts src/__tests__/unit/options.test.ts src/__tests__/unit/parser.test.ts src/__tests__/unit/tail-jq.test.ts src/__tests__/unit/tail-multi-source.test.ts src/__tests__/unit/time.test.ts src/__tests__/unit/trace.test.ts src/__tests__/integration/query-builder.test.ts",
    "test:unit": "bun test --max-concurrency=1 src/__tests__/unit/config.test.ts && bun test --max-concurrency=1 src/__tests__/unit/client-simple.test.ts src/__tests__/unit/formatter.test.ts src/__tests__/unit/options.test.ts src/__tests__/unit/parser.test.ts src/__tests__/unit/tail-jq.test.ts src/__tests__/unit/tail-multi-source.test.ts src/__tests__/unit/time.test.ts src/__tests__/unit/trace.test.ts",
    "test:integration": "bun test --max-concurrency=1 src/__tests__/integration",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "type-check": "tsc --noEmit",
    ci: "bun run lint && bun run type-check && bun run test && bun run build:npm",
    prepublishOnly: "bun run ci",
    format: "oxfmt --write .",
    "format:check": "oxfmt --check .",
    lint: "bun run format:check && oxlint --deny-warnings src",
    "lint:fix": "bun run format && oxlint --fix src"
  },
  dependencies: {
    chalk: "^5.6.2",
    "cli-table3": "^0.6.5",
    commander: "^14.0.3",
    dotenv: "^17.4.2"
  },
  devDependencies: {
    "@types/bun": "^1.3.13",
    "@types/node": "^25.6.2",
    oxfmt: "^0.48.0",
    oxlint: "^1.63.0",
    typescript: "^6.0.3"
  },
  engines: {
    bun: ">=1.0.0"
  },
  packageManager: "bun@1.3.13"
};

// node_modules/chalk/source/index.js
var { stdout: stdoutColor2, stderr: stderrColor2 } = supports_color_default;
var GENERATOR2 = Symbol("GENERATOR");
var STYLER2 = Symbol("STYLER");
var IS_EMPTY2 = Symbol("IS_EMPTY");
var levelMapping2 = [
  "ansi",
  "ansi",
  "ansi256",
  "ansi16m"
];
var styles3 = Object.create(null);
var applyOptions2 = (object, options = {}) => {
  if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor2 ? stdoutColor2.level : 0;
  object.level = options.level === undefined ? colorLevel : options.level;
};
var chalkFactory2 = (options) => {
  const chalk2 = (...strings) => strings.join(" ");
  applyOptions2(chalk2, options);
  Object.setPrototypeOf(chalk2, createChalk2.prototype);
  return chalk2;
};
function createChalk2(options) {
  return chalkFactory2(options);
}
Object.setPrototypeOf(createChalk2.prototype, Function.prototype);
for (const [styleName, style] of Object.entries(ansi_styles_default)) {
  styles3[styleName] = {
    get() {
      const builder = createBuilder2(this, createStyler2(style.open, style.close, this[STYLER2]), this[IS_EMPTY2]);
      Object.defineProperty(this, styleName, { value: builder });
      return builder;
    }
  };
}
styles3.visible = {
  get() {
    const builder = createBuilder2(this, this[STYLER2], true);
    Object.defineProperty(this, "visible", { value: builder });
    return builder;
  }
};
var getModelAnsi2 = (model, level, type, ...arguments_) => {
  if (model === "rgb") {
    if (level === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model === "hex") {
    return getModelAnsi2("rgb", level, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model](...arguments_);
};
var usedModels2 = ["rgb", "hex", "ansi256"];
for (const model of usedModels2) {
  styles3[model] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler2(getModelAnsi2(model, levelMapping2[level], "color", ...arguments_), ansi_styles_default.color.close, this[STYLER2]);
        return createBuilder2(this, styler, this[IS_EMPTY2]);
      };
    }
  };
  const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
  styles3[bgModel] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler2(getModelAnsi2(model, levelMapping2[level], "bgColor", ...arguments_), ansi_styles_default.bgColor.close, this[STYLER2]);
        return createBuilder2(this, styler, this[IS_EMPTY2]);
      };
    }
  };
}
var proto2 = Object.defineProperties(() => {}, {
  ...styles3,
  level: {
    enumerable: true,
    get() {
      return this[GENERATOR2].level;
    },
    set(level) {
      this[GENERATOR2].level = level;
    }
  }
});
var createStyler2 = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === undefined) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent
  };
};
var createBuilder2 = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) => applyStyle2(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto2);
  builder[GENERATOR2] = self;
  builder[STYLER2] = _styler;
  builder[IS_EMPTY2] = _isEmpty;
  return builder;
};
var applyStyle2 = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY2] ? "" : string;
  }
  let styler = self[STYLER2];
  if (styler === undefined) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== undefined) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf(`
`);
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
};
Object.defineProperties(createChalk2.prototype, styles3);
var chalk2 = createChalk2();
var chalkStderr2 = createChalk2({ level: stderrColor2 ? stderrColor2.level : 0 });
var source_default2 = chalk2;

// src/utils/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
var CONFIG_DIR = join(homedir(), ".bslog");
var CONFIG_FILE = join(CONFIG_DIR, "config.json");
var DEFAULT_QUERY_BASE_URL = "https://eu-nbg-2-connect.betterstackdata.com";
function getApiToken() {
  const token = process.env.BETTERSTACK_API_TOKEN;
  if (!token) {
    throw new Error(`BETTERSTACK_API_TOKEN environment variable is not set.
` + `Please add it to your shell configuration:
` + 'export BETTERSTACK_API_TOKEN="your_token_here"');
  }
  return token;
}
function getQueryCredentials() {
  const username = process.env.BETTERSTACK_QUERY_USERNAME;
  const password = process.env.BETTERSTACK_QUERY_PASSWORD;
  return { username, password };
}
function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    return {
      defaultLimit: 100,
      outputFormat: "json",
      defaultLogLevel: "all",
      queryHistory: [],
      savedQueries: {}
    };
  }
  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(content);
    if (!parsed.defaultLogLevel) {
      parsed.defaultLogLevel = "all";
    }
    return parsed;
  } catch {
    console.warn("Failed to load config, using defaults");
    return {
      defaultLimit: 100,
      outputFormat: "json",
      defaultLogLevel: "all"
    };
  }
}
function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
function updateConfig(updates) {
  const config = loadConfig();
  const newConfig = { ...config, ...updates };
  saveConfig(newConfig);
}
function addToHistory(query) {
  const config = loadConfig();
  const history = config.queryHistory || [];
  history.unshift(query);
  if (history.length > 100) {
    history.pop();
  }
  updateConfig({ queryHistory: history });
}
var SOURCE_ALIASES = {
  dev: "sweetistics-dev",
  development: "sweetistics-dev",
  prod: "sweetistics",
  production: "sweetistics",
  staging: "sweetistics-staging",
  test: "sweetistics-test"
};
function resolveSourceAlias(source) {
  if (source === undefined || source === null) {
    return;
  }
  const aliased = SOURCE_ALIASES[source.toLowerCase()];
  if (aliased) {
    return aliased;
  }
  return source;
}

// src/commands/config.ts
function setConfig(key, value) {
  const validKeys = ["source", "limit", "format", "logLevel", "queryBaseUrl"];
  if (!validKeys.includes(key)) {
    console.error(source_default2.red(`Invalid config key: ${key}`));
    console.error(`Valid keys: ${validKeys.join(", ")}`);
    process.exit(1);
  }
  switch (key) {
    case "source":
      updateConfig({ defaultSource: value });
      console.log(source_default2.green(`Default source set to: ${value}`));
      break;
    case "limit": {
      const limit = Number.parseInt(value, 10);
      if (Number.isNaN(limit) || limit < 1) {
        console.error(source_default2.red("Limit must be a positive number"));
        process.exit(1);
      }
      updateConfig({ defaultLimit: limit });
      console.log(source_default2.green(`Default limit set to: ${limit}`));
      break;
    }
    case "format": {
      const validFormats = ["json", "table", "csv", "pretty"];
      const isOutputFormat = (candidate) => validFormats.includes(candidate);
      if (!isOutputFormat(value)) {
        console.error(source_default2.red(`Invalid format: ${value}`));
        console.error(`Valid formats: ${validFormats.join(", ")}`);
        process.exit(1);
      }
      updateConfig({ outputFormat: value });
      console.log(source_default2.green(`Default output format set to: ${value}`));
      break;
    }
    case "logLevel": {
      const normalized = value.trim().toLowerCase();
      const aliases = {
        warn: "warning"
      };
      const resolved = aliases[normalized] ?? normalized;
      const validLevels = new Set(["all", "debug", "info", "warning", "error", "fatal", "trace"]);
      if (!validLevels.has(resolved)) {
        console.error(source_default2.red(`Invalid log level: ${value}`));
        console.error(`Valid levels: ${Array.from(validLevels).join(", ")}`);
        process.exit(1);
      }
      updateConfig({ defaultLogLevel: resolved });
      console.log(source_default2.green(`Default log level set to: ${resolved}`));
      break;
    }
    case "queryBaseUrl": {
      const url = value.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        console.error(source_default2.red("queryBaseUrl must start with http:// or https://"));
        process.exit(1);
      }
      updateConfig({ queryBaseUrl: url });
      console.log(source_default2.green(`Query base URL set to: ${url}`));
      break;
    }
  }
}
function showConfig(options = {}) {
  const config = loadConfig();
  if (options.format === "json") {
    const normalized = {
      defaultSource: config.defaultSource ?? null,
      defaultLimit: config.defaultLimit ?? 100,
      defaultLogLevel: config.defaultLogLevel ?? "all",
      outputFormat: config.outputFormat ?? "json",
      queryBaseUrl: config.queryBaseUrl ?? DEFAULT_QUERY_BASE_URL,
      savedQueries: config.savedQueries ?? {},
      queryHistory: config.queryHistory ?? []
    };
    console.log(JSON.stringify(normalized, null, 2));
    return;
  }
  console.log(source_default2.bold(`
Current Configuration:
`));
  console.log(`Default Source: ${config.defaultSource || source_default2.gray("(not set)")}`);
  console.log(`Default Limit: ${config.defaultLimit || 100}`);
  console.log(`Default Log Level: ${config.defaultLogLevel || "all"}`);
  console.log(`Output Format: ${config.outputFormat || "json"}`);
  console.log(`Query Base URL: ${config.queryBaseUrl || DEFAULT_QUERY_BASE_URL}`);
  if (config.savedQueries && Object.keys(config.savedQueries).length > 0) {
    console.log(source_default2.bold(`
Saved Queries:`));
    for (const [name, query] of Object.entries(config.savedQueries)) {
      console.log(`  ${source_default2.cyan(name)}: ${query}`);
    }
  }
  console.log();
}

// src/utils/time.ts
function parseTimeString(timeStr) {
  const now = new Date;
  const relativeMatch = timeStr.match(/^(\d+)([hdmw])$/);
  if (relativeMatch) {
    const [, amount, unit] = relativeMatch;
    const value = Number.parseInt(amount, 10);
    switch (unit) {
      case "h":
        return new Date(now.getTime() - value * 60 * 60 * 1000);
      case "d":
        return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      case "m":
        return new Date(now.getTime() - value * 60 * 1000);
      case "w":
        return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }
  }
  if (/^\d+[a-z]$/i.test(timeStr)) {
    const unit = timeStr.match(/[a-z]$/i)?.[0];
    throw new Error(`Unknown time unit: ${unit}`);
  }
  const date = new Date(timeStr);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
  return date;
}
function toClickHouseDateTime(date) {
  const iso = date.toISOString();
  return iso.slice(0, 19).replace("T", " ");
}

// src/api/client.ts
var TELEMETRY_BASE_URL = "https://telemetry.betterstack.com/api/v1";
function resolveQueryBaseUrl(config = loadConfig()) {
  return process.env.BSLOG_QUERY_HOST || config.queryBaseUrl || DEFAULT_QUERY_BASE_URL;
}
var DEFAULT_TIMEOUT_MS = 30000;

class BetterStackClient {
  token;
  constructor() {
    this.token = getApiToken();
  }
  async request(url, options = {}) {
    const { timeoutMs, signal: providedSignal, headers: providedHeaders, ...rest } = options;
    const headers = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      ...providedHeaders
    };
    const { signal, dispose } = createRequestSignal(providedSignal, timeoutMs);
    try {
      const response = await fetch(url, {
        ...rest,
        headers,
        signal
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed: ${response.status} - ${error}`);
      }
      return response.json();
    } finally {
      dispose();
    }
  }
  telemetry(path, options = {}) {
    const url = `${TELEMETRY_BASE_URL}${path}`;
    return this.request(url, options);
  }
  async query(sql, username, password) {
    const headers = {
      "Content-Type": "text/plain"
    };
    if (username && password) {
      const auth = Buffer.from(`${username}:${password}`).toString("base64");
      headers.Authorization = `Basic ${auth}`;
    } else {
      headers.Authorization = `Bearer ${this.token}`;
    }
    const { signal, dispose } = createRequestSignal(undefined, DEFAULT_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(resolveQueryBaseUrl(), {
        method: "POST",
        headers,
        body: sql,
        signal
      });
    } finally {
      dispose();
    }
    if (!response.ok) {
      const error = await response.text();
      if (response.status === 400 && error.includes("Malformed token")) {
        throw new Error(`Query API authentication failed: Malformed token

` + `This usually means your Query API credentials are not set.

` + `Current environment:
` + `  BETTERSTACK_API_TOKEN: ${process.env.BETTERSTACK_API_TOKEN ? "✓ Set" : "✗ Not set"}
` + `  BETTERSTACK_QUERY_USERNAME: ${process.env.BETTERSTACK_QUERY_USERNAME ? "✓ Set" : "✗ Not set"}
` + `  BETTERSTACK_QUERY_PASSWORD: ${process.env.BETTERSTACK_QUERY_PASSWORD ? "✓ Set" : "✗ Not set"}

` + `To fix this:
` + `1. Add these to your ~/.zshrc or ~/.bashrc:
` + `   export BETTERSTACK_QUERY_USERNAME="your_username"
` + `   export BETTERSTACK_QUERY_PASSWORD="your_password"

` + `2. Reload your shell:
` + `   source ~/.zshrc

` + `3. Or set them for this session:
` + `   export BETTERSTACK_QUERY_USERNAME="your_username"
` + `   export BETTERSTACK_QUERY_PASSWORD="your_password"

` + `To get Query API credentials:
` + `1. Go to Better Stack > Logs > Dashboards
` + `2. Click "Connect remotely"
` + `3. Create credentials and save them`);
      }
      if (response.status === 403 || response.status === 401 || error.includes("Authentication failed")) {
        if (!username || !password) {
          throw new Error(`Query API authentication failed.

` + `The Query API requires separate credentials from your API token.
` + `To create credentials:
` + `1. Go to Better Stack > Logs > Dashboards
` + `2. Click "Connect remotely"
` + `3. Create credentials and save them

` + `Then set them as environment variables:
` + `export BETTERSTACK_QUERY_USERNAME="your_username"
` + `export BETTERSTACK_QUERY_PASSWORD="your_password"

` + `Or pass them directly:
` + `bslog tail --username "user" --password "pass"`);
        }
        throw new Error(`Authentication failed. Please check your Query API credentials.`);
      }
      throw new Error(`Query failed: ${response.status} - ${error}`);
    }
    const text = await response.text();
    const lines = text.trim().split(`
`).filter((line) => line.length > 0);
    const rows = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === "object") {
          rows.push(parsed);
        } else {
          console.error("Unexpected row payload:", line);
        }
      } catch {
        console.error("Failed to parse line:", line);
      }
    }
    return rows;
  }
}
function createRequestSignal(existing, timeoutMs) {
  if (existing) {
    return {
      signal: existing,
      dispose: () => {}
    };
  }
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (typeof AbortSignal !== "undefined") {
    const abortSignalWithTimeout = AbortSignal.timeout;
    if (typeof abortSignalWithTimeout === "function") {
      return {
        signal: abortSignalWithTimeout(timeout),
        dispose: () => {}
      };
    }
  }
  const controller = new AbortController;
  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);
  if (typeof timer === "object" && typeof timer.unref === "function") {
    timer.unref();
  }
  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timer)
  };
}

// src/api/sources.ts
class SourcesAPI {
  client;
  constructor() {
    this.client = new BetterStackClient;
  }
  list(page = 1, perPage = 50) {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString()
    });
    return this.client.telemetry(`/sources?${params}`);
  }
  async listAll() {
    const sources = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await this.list(page, 50);
      sources.push(...response.data);
      if (response.pagination) {
        const { total, page: currentPage, per_page } = response.pagination;
        hasMore = currentPage * per_page < total;
        page++;
      } else {
        hasMore = false;
      }
    }
    return sources;
  }
  async get(sourceId) {
    const response = await this.client.telemetry(`/sources/${sourceId}`);
    return response.data;
  }
  async findByName(name) {
    const sources = await this.listAll();
    return sources.find((s) => s.attributes.name === name) || null;
  }
}

// src/api/query.ts
var VALID_IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
function escapeSqlString(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

class QueryAPI {
  client;
  sourcesAPI;
  constructor() {
    this.client = new BetterStackClient;
    this.sourcesAPI = new SourcesAPI;
  }
  buildJsonPath(field) {
    const trimmed = field.trim();
    if (trimmed.startsWith("$")) {
      return trimmed;
    }
    const segments = [];
    let buffer = "";
    let inBracket = false;
    let quoteChar = null;
    const flushPlain = () => {
      const segment = buffer.trim();
      if (segment) {
        segments.push(segment);
      }
      buffer = "";
    };
    const flushBracket = () => {
      if (buffer) {
        segments.push(buffer);
      }
      buffer = "";
    };
    for (let index = 0;index < trimmed.length; index += 1) {
      const char = trimmed.charAt(index);
      if (!inBracket) {
        if (char === ".") {
          flushPlain();
          continue;
        }
        if (char === "[") {
          flushPlain();
          inBracket = true;
          buffer = "[";
          quoteChar = null;
          continue;
        }
        buffer += char;
        continue;
      }
      buffer += char;
      if (char === '"' || char === "'") {
        const previous = trimmed[index - 1];
        if (quoteChar === char && previous !== "\\") {
          quoteChar = null;
        } else if (!quoteChar) {
          quoteChar = char;
        }
      } else if (char === "]" && !quoteChar) {
        flushBracket();
        inBracket = false;
      }
    }
    if (buffer) {
      if (inBracket) {
        segments.push(buffer);
      } else {
        flushPlain();
      }
    }
    let path = "$";
    for (const segment of segments) {
      if (!segment) {
        continue;
      }
      if (segment.startsWith("[")) {
        path += this.normalizeBracketSegment(segment);
      } else {
        path += this.normalizePlainSegment(segment);
      }
    }
    return path;
  }
  buildJsonAccessor(field) {
    const path = this.buildJsonPath(field);
    return `JSON_VALUE(raw, '${path}')`;
  }
  normalizePlainSegment(segment) {
    const cleaned = segment.trim();
    if (!cleaned) {
      return "";
    }
    if (VALID_IDENTIFIER_REGEX.test(cleaned)) {
      return `.${cleaned}`;
    }
    const escaped = cleaned.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    return `["${escaped}"]`;
  }
  normalizeBracketSegment(segment) {
    if (!segment.startsWith("[") || !segment.endsWith("]")) {
      return this.normalizePlainSegment(segment);
    }
    const inner = segment.slice(1, -1).trim();
    if (!inner) {
      return segment;
    }
    if (inner === "*") {
      return "[*]";
    }
    const quote = inner[0];
    const isQuoted = quote === '"' || quote === "'";
    if (isQuoted && inner[inner.length - 1] === quote) {
      const key = inner.slice(1, -1).replace(/\\(['"])/g, "$1");
      const escaped2 = key.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
      return `["${escaped2}"]`;
    }
    if (/^-?\d+$/.test(inner)) {
      return `[${inner}]`;
    }
    const escaped = inner.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    return `["${escaped}"]`;
  }
  async buildQuery(options) {
    const config = loadConfig();
    const configLevel = config.defaultLogLevel && config.defaultLogLevel.toLowerCase() !== "all" ? config.defaultLogLevel : undefined;
    const effectiveLevel = options.level ?? configLevel;
    const rawSourceName = options.source || config.defaultSource;
    const sourceName = resolveSourceAlias(rawSourceName);
    if (!sourceName) {
      throw new Error("No source specified. Use --source or set a default source with: bslog config source <name>");
    }
    const source = await this.sourcesAPI.findByName(sourceName);
    if (!source) {
      throw new Error(`Source not found: ${sourceName}`);
    }
    const tableName = `t${source.attributes.team_id}_${source.attributes.table_name}_logs`;
    const fields = options.fields && options.fields.length > 0 ? this.buildFieldSelection(options.fields) : "dt, raw";
    let sql = `SELECT ${fields} FROM remote(${tableName})`;
    const conditions = [];
    if (options.since) {
      const sinceDate = parseTimeString(options.since);
      conditions.push(`dt >= toDateTime64('${toClickHouseDateTime(sinceDate)}', 3)`);
    }
    if (options.until) {
      const untilDate = parseTimeString(options.until);
      conditions.push(`dt <= toDateTime64('${toClickHouseDateTime(untilDate)}', 3)`);
    }
    if (effectiveLevel) {
      const escapedLevel = effectiveLevel.replace(/'/g, "''").toLowerCase();
      const levelExpression = `lowerUTF8(COALESCE(` + `JSONExtractString(raw, 'level'),` + `JSON_VALUE(raw, '$.level'),` + `JSON_VALUE(raw, '$.levelName'),` + `JSON_VALUE(raw, '$.vercel.level')
      ))`;
      const messageExpression = `COALESCE(JSONExtractString(raw, 'message'), JSON_VALUE(raw, '$.message'))`;
      const statusExpression = `toInt32OrZero(JSON_VALUE(raw, '$.vercel.proxy.status_code'))`;
      if (escapedLevel === "error") {
        conditions.push(`(${levelExpression} = '${escapedLevel}' OR ${statusExpression} >= 500 OR positionCaseInsensitive(${messageExpression}, 'error') > 0 OR JSONHas(raw, 'error'))`);
      } else if (escapedLevel === "warning" || escapedLevel === "warn") {
        conditions.push(`(${levelExpression} IN ('${escapedLevel}', 'warning', 'warn') OR (${statusExpression} >= 400 AND ${statusExpression} < 500))`);
      } else {
        conditions.push(`${levelExpression} = '${escapedLevel}'`);
      }
    }
    if (options.subsystem) {
      const subsystemAccessor = this.buildJsonAccessor("subsystem");
      conditions.push(`${subsystemAccessor} = '${escapeSqlString(options.subsystem)}'`);
    }
    if (options.search) {
      conditions.push(`raw LIKE '%${escapeSqlString(options.search)}%'`);
    }
    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        const accessor = this.buildJsonAccessor(key);
        if (value === null) {
          conditions.push(`${accessor} IS NULL`);
          continue;
        }
        if (typeof value === "string") {
          conditions.push(`${accessor} = '${escapeSqlString(value)}'`);
        } else {
          const serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
          conditions.push(`${accessor} = '${escapeSqlString(serialized)}'`);
        }
      }
    }
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }
    sql += " ORDER BY dt DESC";
    sql += ` LIMIT ${options.limit || config.defaultLimit || 100}`;
    sql += " FORMAT JSONEachRow";
    return sql;
  }
  buildFieldSelection(fields) {
    const selections = ["dt"];
    for (const field of fields) {
      if (field === "*" || field === "raw") {
        selections.push("raw");
        continue;
      }
      if (field === "dt") {
        continue;
      }
      const accessor = this.buildJsonAccessor(field);
      const escapedAlias = field.replace(/"/g, '""');
      selections.push(`${accessor} AS "${escapedAlias}"`);
    }
    return selections.join(", ");
  }
  async execute(options) {
    const sql = await this.buildQuery(options);
    if (options.verbose) {
      console.error(`Executing query: ${sql}`);
    }
    const { username, password } = getQueryCredentials();
    return this.client.query(sql, username, password);
  }
  executeSql(sql) {
    let statement = sql;
    if (!statement.toLowerCase().includes("format")) {
      statement = `${statement} FORMAT JSONEachRow`;
    }
    const { username, password } = getQueryCredentials();
    return this.client.query(statement, username, password);
  }
}

// src/parser/graphql.ts
function parseGraphQLQuery(query) {
  let normalizedQuery = query.trim();
  if (normalizedQuery.startsWith("{") && normalizedQuery.endsWith("}")) {
    normalizedQuery = normalizedQuery.slice(1, -1).trim();
  }
  const logsMatch = normalizedQuery.match(/logs\s*\((.*?)\)\s*\{(.*?)\}/s);
  if (!logsMatch) {
    throw new Error("Invalid query format. Expected: { logs(...) { ... } }");
  }
  const [, argsStr = "", fieldsStr = ""] = logsMatch;
  const options = {};
  if (argsStr) {
    const args = parseArguments(argsStr);
    const limit = typeof args.limit === "number" ? args.limit : typeof args.limit === "string" ? Number.parseInt(args.limit, 10) : undefined;
    if (limit !== undefined) {
      options.limit = limit;
    }
    if (typeof args.level === "string") {
      options.level = args.level;
    }
    if (typeof args.subsystem === "string") {
      options.subsystem = args.subsystem;
    }
    if (typeof args.since === "string") {
      options.since = args.since;
    }
    if (typeof args.until === "string") {
      options.until = args.until;
    }
    if (args.between && Array.isArray(args.between) && args.between.length === 2) {
      const [since, until] = args.between;
      if (typeof since === "string" && typeof until === "string") {
        options.since = since;
        options.until = until;
      }
    }
    if (typeof args.search === "string") {
      options.search = args.search;
    }
    if (isRecord(args.where)) {
      options.where = args.where;
    }
    if (typeof args.source === "string") {
      options.source = args.source;
    }
  }
  if (fieldsStr) {
    const fields = fieldsStr.split(",").map((f) => f.trim()).filter((f) => f.length > 0);
    if (fields.length > 0 && fields[0] !== "*") {
      options.fields = fields;
    }
  }
  return options;
}
function parseArguments(argsStr) {
  const result = {};
  let currentKey = "";
  let currentValue = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";
  for (let i = 0;i < argsStr.length; i++) {
    const char = argsStr[i];
    if (inString) {
      if (char === stringChar && argsStr[i - 1] !== "\\") {
        inString = false;
      }
      currentValue += char;
    } else if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      currentValue += char;
    } else if (char === "{" || char === "[") {
      depth++;
      currentValue += char;
    } else if (char === "}" || char === "]") {
      depth--;
      currentValue += char;
    } else if (char === ":" && depth === 0 && !currentKey) {
      currentKey = currentValue.trim();
      currentValue = "";
    } else if (char === "," && depth === 0) {
      if (currentKey) {
        result[currentKey] = parseValue(currentValue.trim());
        currentKey = "";
        currentValue = "";
      }
    } else {
      currentValue += char;
    }
  }
  if (currentKey && currentValue) {
    result[currentKey] = parseValue(currentValue.trim());
  }
  return result;
}
function parseValue(value) {
  if (value.startsWith("'") && value.endsWith("'") || value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      const objStr = value.slice(1, -1);
      const obj = {};
      const pairs = objStr.split(",");
      for (const pair of pairs) {
        const [key, val] = pair.split(":").map((s) => s.trim());
        if (key && val) {
          obj[key] = parseValue(val);
        }
      }
      return obj;
    } catch {
      return value;
    }
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const arrStr = value.slice(1, -1);
      return arrStr.split(",").map((s) => parseValue(s.trim()));
    } catch {
      return value;
    }
  }
  return value;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/utils/formatter.ts
var import_cli_table3 = __toESM(require_table(), 1);
function formatOutput(data, format = "json") {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "pretty":
      return formatPretty(data);
    case "table":
      return formatTable(data);
    case "csv":
      return formatCSV(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}
function formatPretty(data) {
  const output = [];
  for (const entry of data) {
    const timestampValue = typeof entry.dt === "string" ? entry.dt : "No timestamp";
    const timestamp = source_default2.gray(timestampValue);
    let level = typeof entry.level === "string" ? entry.level : extractLevel(entry);
    if (level) {
      switch (level.toLowerCase()) {
        case "error":
        case "fatal":
          level = source_default2.red(level.toUpperCase());
          break;
        case "warn":
        case "warning":
          level = source_default2.yellow(level.toUpperCase());
          break;
        case "info":
          level = source_default2.blue(level.toUpperCase());
          break;
        case "debug":
          level = source_default2.gray(level.toUpperCase());
          break;
        default:
          level = source_default2.white(level.toUpperCase());
      }
    } else {
      level = source_default2.gray("LOG");
    }
    const message = extractMessage(entry);
    const subsystem = typeof entry.subsystem === "string" && entry.subsystem.length > 0 ? entry.subsystem : extractSubsystem(entry);
    let line = `[${timestamp}] ${level}`;
    if (subsystem) {
      line += ` ${source_default2.cyan(`[${subsystem}]`)}`;
    }
    line += ` ${message}`;
    output.push(line);
    const extraFields = getExtraFields(entry);
    if (Object.keys(extraFields).length > 0) {
      const extras = Object.entries(extraFields).map(([key, value]) => `  ${source_default2.gray(key)}: ${formatValue(value)}`).join(`
`);
      output.push(extras);
    }
  }
  return output.join(`
`);
}
function formatTable(data) {
  if (data.length === 0) {
    return "No results found";
  }
  const allKeys = new Set;
  for (const entry of data) {
    for (const key of Object.keys(entry)) {
      allKeys.add(key);
    }
  }
  const headers = Array.from(allKeys);
  const table = new import_cli_table3.default({
    head: headers,
    wordWrap: true,
    colWidths: headers.map((h) => {
      if (h === "dt") {
        return 20;
      }
      if (h === "raw") {
        return 50;
      }
      if (h === "message") {
        return 40;
      }
      return null;
    })
  });
  for (const entry of data) {
    const row = headers.map((header) => {
      const value = entry[header];
      if (value === undefined) {
        return "";
      }
      if (typeof value === "object") {
        return JSON.stringify(value);
      }
      return String(value);
    });
    table.push(row);
  }
  return table.toString();
}
function formatCSV(data) {
  if (data.length === 0) {
    return "";
  }
  const allKeys = new Set;
  for (const entry of data) {
    for (const key of Object.keys(entry)) {
      allKeys.add(key);
    }
  }
  const headers = Array.from(allKeys);
  const lines = [];
  lines.push(headers.map((h) => escapeCSV(h)).join(","));
  for (const entry of data) {
    const row = headers.map((header) => {
      const value = entry[header];
      if (value === undefined) {
        return "";
      }
      if (typeof value === "object") {
        return escapeCSV(JSON.stringify(value));
      }
      return escapeCSV(String(value));
    });
    lines.push(row.join(","));
  }
  return lines.join(`
`);
}
function escapeCSV(value) {
  if (value.includes(",") || value.includes('"') || value.includes(`
`)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
function extractLevel(entry) {
  if (typeof entry.level === "string" && entry.level.length > 0) {
    return entry.level;
  }
  const parsed = parseRaw(entry.raw);
  if (parsed) {
    const level = parsed.level;
    if (typeof level === "string" && level.length > 0) {
      return level;
    }
    const severity = parsed.severity;
    if (typeof severity === "string" && severity.length > 0) {
      return severity;
    }
    const vercel = parsed.vercel;
    if (vercel && typeof vercel === "object") {
      const vercelLevel = vercel.level;
      if (typeof vercelLevel === "string" && vercelLevel.length > 0) {
        return vercelLevel;
      }
    }
    return null;
  }
  if (typeof entry.raw === "string") {
    const match = entry.raw.match(/\b(ERROR|WARN|WARNING|INFO|DEBUG|FATAL)\b/i);
    return match ? match[1] ?? null : null;
  }
  return null;
}
function extractMessage(entry) {
  if (typeof entry.message === "string" && entry.message.length > 0) {
    return entry.message;
  }
  const parsed = parseRaw(entry.raw);
  if (parsed) {
    const primary = parsed.message ?? parsed.msg;
    if (typeof primary === "string" && primary.length > 0) {
      return primary;
    }
    return JSON.stringify(parsed);
  }
  if (typeof entry.raw === "string" && entry.raw.length > 0) {
    return entry.raw;
  }
  return JSON.stringify(entry);
}
function extractSubsystem(entry) {
  if (typeof entry.subsystem === "string" && entry.subsystem.length > 0) {
    return entry.subsystem;
  }
  const parsed = parseRaw(entry.raw);
  if (parsed) {
    const subsystem = parsed.subsystem ?? parsed.service ?? parsed.component;
    if (typeof subsystem === "string" && subsystem.length > 0) {
      return subsystem;
    }
  }
  return null;
}
function getExtraFields(entry) {
  const excludeKeys = new Set(["dt", "raw", "level", "message", "subsystem", "time", "severity"]);
  const extras = {};
  if (entry.raw !== undefined) {
    const parsed = parseRaw(entry.raw);
    if (parsed) {
      for (const [key, value] of Object.entries(parsed)) {
        if (!excludeKeys.has(key)) {
          extras[key] = value;
        }
      }
    } else {
      extras.raw = entry.raw;
    }
  }
  for (const [key, value] of Object.entries(entry)) {
    if (!excludeKeys.has(key) && key !== "raw") {
      extras[key] = value;
    }
  }
  return extras;
}
function formatValue(value) {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
function parseRaw(raw) {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (raw && typeof raw === "object") {
    return raw;
  }
  return null;
}

// src/commands/query.ts
async function runQuery(queryStr, options) {
  const api = new QueryAPI;
  try {
    const queryOptions = parseGraphQLQuery(queryStr);
    const finalOptions = {
      ...queryOptions,
      ...options
    };
    addToHistory(queryStr);
    const results = await api.execute(finalOptions);
    const output = formatOutput(results, options.format || "pretty");
    console.log(output);
    if (results.length === 0) {
      console.error(source_default2.yellow(`
No results found`));
    } else {
      console.error(source_default2.gray(`
${results.length} results returned`));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(source_default2.red(`Query error: ${message}`));
    process.exit(1);
  }
}
async function runSql(sql, options) {
  const api = new QueryAPI;
  try {
    addToHistory(`SQL: ${sql}`);
    const results = await api.executeSql(sql);
    const output = formatOutput(results, options.format || "json");
    console.log(output);
    if (results.length === 0) {
      console.error(source_default2.yellow(`
No results found`));
    } else {
      console.error(source_default2.gray(`
${results.length} results returned`));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(source_default2.red(`SQL error: ${message}`));
    process.exit(1);
  }
}

// src/commands/sources.ts
async function listSources(options) {
  const api = new SourcesAPI;
  try {
    const sources = await api.listAll();
    if (options.format === "table" || options.format === "pretty") {
      console.log(source_default2.bold(`
Available Sources:
`));
      for (const source of sources) {
        const { name, platform, messages_count, bytes_count, ingesting_paused } = source.attributes;
        console.log(source_default2.cyan(`  ${name}`));
        console.log(`    Platform: ${platform}`);
        console.log(`    Messages: ${messages_count ? messages_count.toLocaleString() : "0"}`);
        console.log(`    Size: ${formatBytes(bytes_count || 0)}`);
        console.log(`    Status: ${ingesting_paused ? source_default2.red("Paused") : source_default2.green("Active")}`);
        console.log(`    ID: ${source.id}`);
        console.log();
      }
    } else {
      const output = formatOutput(sources, options.format || "json");
      console.log(output);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(source_default2.red(`Error listing sources: ${message}`));
    process.exit(1);
  }
}
async function getSource(name, options) {
  const api = new SourcesAPI;
  try {
    const source = await api.findByName(name);
    if (!source) {
      console.error(source_default2.red(`Source not found: ${name}`));
      process.exit(1);
    }
    if (options.format === "pretty") {
      const { attributes } = source;
      console.log(source_default2.bold(`
Source: ${attributes.name}
`));
      console.log(`ID: ${source.id}`);
      console.log(`Platform: ${attributes.platform}`);
      console.log(`Token: ${attributes.token ? `${attributes.token.substring(0, 10)}...` : "N/A"}`);
      console.log(`Messages: ${attributes.messages_count ? attributes.messages_count.toLocaleString() : "0"}`);
      console.log(`Size: ${formatBytes(attributes.bytes_count || 0)}`);
      console.log(`Status: ${attributes.ingesting_paused ? source_default2.red("Paused") : source_default2.green("Active")}`);
      console.log(`Created: ${attributes.created_at ? new Date(attributes.created_at).toLocaleString() : "N/A"}`);
      console.log(`Updated: ${attributes.updated_at ? new Date(attributes.updated_at).toLocaleString() : "N/A"}`);
    } else {
      const output = formatOutput([source], options.format || "json");
      console.log(output);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(source_default2.red(`Error getting source: ${message}`));
    process.exit(1);
  }
}
function formatBytes(bytes) {
  if (bytes === 0) {
    return "0 Bytes";
  }
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

// src/commands/tail.ts
import { spawnSync } from "node:child_process";
var jqRunner = spawnSync;
async function tailLogs(options) {
  const api = new QueryAPI;
  const config = loadConfig();
  const {
    follow,
    interval,
    format,
    jq,
    sources: multiSourceOption,
    fields: rawFields,
    ...remainingOptions
  } = options;
  const queryOptions = {
    ...remainingOptions
  };
  const normalizedFields = normalizeFieldsOption(rawFields);
  if (normalizedFields) {
    queryOptions.fields = normalizedFields;
  } else {
    delete queryOptions.fields;
  }
  const limit = normalizeLimit(queryOptions.limit);
  queryOptions.limit = limit;
  const resolvedSource = resolveSourceAlias(queryOptions.source);
  if (resolvedSource) {
    queryOptions.source = resolvedSource;
  }
  const resolvedSources = new Set;
  if (resolvedSource) {
    resolvedSources.add(resolvedSource);
  }
  if (multiSourceOption?.length) {
    for (const candidate of multiSourceOption) {
      const resolved = resolveSourceAlias(candidate);
      if (resolved) {
        resolvedSources.add(resolved);
      }
    }
  }
  if (resolvedSources.size === 0) {
    const defaultSource = resolveSourceAlias(config.defaultSource);
    if (defaultSource) {
      resolvedSources.add(defaultSource);
    }
  }
  try {
    if (resolvedSources.size <= 1) {
      if (resolvedSources.size === 1) {
        queryOptions.source = [...resolvedSources][0];
      }
      if (queryOptions.source === undefined) {
        queryOptions.source = resolvedSource;
      }
      await runSingleSource(api, queryOptions, { follow, interval, format, jq });
      return;
    }
    queryOptions.source = undefined;
    await runMultiSource(api, queryOptions, { follow, interval, format, jq }, [...resolvedSources]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(source_default2.red(`Tail error: ${message}`));
    process.exit(1);
  }
}
async function runSingleSource(api, options, runtime) {
  const outputFormat = resolveFormat(runtime.format, runtime.jq);
  let lastTimestamp = null;
  const results = await api.execute(options);
  if (results.length > 0) {
    printResults(results, outputFormat, runtime.jq);
    lastTimestamp = results[0].dt;
  }
  if (!runtime.follow) {
    return;
  }
  console.error(source_default2.gray(`
Following logs... (Press Ctrl+C to stop)`));
  const intervalMs = resolveInterval(runtime.interval);
  const pollLimit = Math.max(1, Math.min(50, options.limit ?? 50));
  const sinceFallback = options.since ?? "1m";
  setInterval(async () => {
    try {
      const pollOptions = {
        ...options,
        limit: pollLimit,
        since: lastTimestamp || sinceFallback
      };
      const newResults = await api.execute(pollOptions);
      if (newResults.length === 0) {
        return;
      }
      const previousTimestamp = lastTimestamp;
      const filtered = previousTimestamp ? newResults.filter((entry) => entry.dt > previousTimestamp) : newResults;
      if (filtered.length === 0) {
        return;
      }
      printResults(filtered, outputFormat, runtime.jq);
      lastTimestamp = filtered[0].dt;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(source_default2.red(`Polling error: ${message}`));
    }
  }, intervalMs);
  process.stdin.resume();
}
async function runMultiSource(api, baseOptions, runtime, sources) {
  const outputFormat = resolveFormat(runtime.format, runtime.jq);
  const limit = baseOptions.limit ?? 100;
  const perSourceLatest = new Map;
  const collect = async (sinceMap, limitOverride, fallbackSince2) => {
    const limitPerSource = Math.max(1, limitOverride ?? limit);
    const combined = [];
    const latestBySource2 = new Map;
    for (const source of sources) {
      const perSourceOptions = {
        ...baseOptions,
        source,
        limit: limitPerSource
      };
      const sinceCandidate = sinceMap?.get(source) ?? baseOptions.since ?? fallbackSince2;
      perSourceOptions.since = sinceCandidate || undefined;
      const result = await api.execute(perSourceOptions);
      if (result.length > 0) {
        latestBySource2.set(source, result[0].dt);
        for (const entry of result) {
          combined.push({ ...entry, source });
        }
      }
    }
    combined.sort((a, b) => {
      if (a.dt === b.dt) {
        return 0;
      }
      return a.dt < b.dt ? 1 : -1;
    });
    return {
      combined: combined.slice(0, limitPerSource),
      latestBySource: latestBySource2
    };
  };
  const { combined: initialCombined, latestBySource } = await collect();
  for (const [source, dt] of latestBySource) {
    perSourceLatest.set(source, dt);
  }
  if (initialCombined.length > 0) {
    printResults(initialCombined, outputFormat, runtime.jq);
  }
  if (!runtime.follow) {
    return;
  }
  console.error(source_default2.gray(`
Following logs... (Press Ctrl+C to stop)`));
  const intervalMs = resolveInterval(runtime.interval);
  const pollLimit = Math.max(1, Math.min(50, limit));
  const fallbackSince = baseOptions.since ? undefined : "1m";
  setInterval(async () => {
    try {
      const { combined, latestBySource: followLatest } = await collect(perSourceLatest, pollLimit, fallbackSince);
      if (combined.length > 0) {
        const newEntries = combined.filter((entry) => {
          const previous = perSourceLatest.get(entry.source);
          return !previous || entry.dt > previous;
        });
        if (newEntries.length > 0) {
          printResults(newEntries, outputFormat, runtime.jq);
        }
      }
      for (const [source, dt] of followLatest) {
        const previous = perSourceLatest.get(source);
        if (!previous || dt > previous) {
          perSourceLatest.set(source, dt);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(source_default2.red(`Polling error: ${message}`));
    }
  }, intervalMs);
  process.stdin.resume();
}
function resolveFormat(format, jqFilter) {
  if (jqFilter) {
    return "json";
  }
  if (format === "json" || format === "table" || format === "csv" || format === "pretty") {
    return format;
  }
  return "pretty";
}
function resolveInterval(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 2000;
}
function normalizeLimit(limit) {
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return Math.floor(limit);
  }
  return 100;
}
function normalizeFieldsOption(fields) {
  if (!fields) {
    return;
  }
  const rawValues = Array.isArray(fields) ? fields : [fields];
  const names = rawValues.flatMap((value) => value.split(",")).map((name) => name.trim()).filter((name) => name.length > 0);
  if (names.length === 0) {
    return;
  }
  return Array.from(new Set(names));
}
function showErrors(options) {
  return tailLogs({
    ...options,
    level: "error"
  });
}
function showWarnings(options) {
  return tailLogs({
    ...options,
    level: "warning"
  });
}
function searchLogs(pattern, options) {
  return tailLogs({
    ...options,
    search: pattern
  });
}
function printResults(entries, format, jqFilter) {
  const payload = formatOutput(entries, format);
  if (!jqFilter) {
    console.log(payload);
    return;
  }
  try {
    const result = jqRunner("jq", [jqFilter], {
      input: payload,
      encoding: "utf8"
    });
    if (result.error) {
      console.error(source_default2.red(`jq execution failed: ${result.error.message}`));
      console.log(payload);
      return;
    }
    if (result.status !== 0) {
      const stderr = result.stderr?.trim();
      if (stderr) {
        console.error(source_default2.red(`jq exited with status ${result.status}: ${stderr}`));
      } else {
        console.error(source_default2.red(`jq exited with status ${result.status}`));
      }
      console.log(payload);
      return;
    }
    const output = result.stdout ?? "";
    process.stdout.write(output);
    if (!output.endsWith(`
`)) {
      process.stdout.write(`
`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(source_default2.red(`jq integration error: ${message}`));
    console.log(payload);
  }
}

// src/commands/tail.ts
import { spawnSync as spawnSync2 } from "node:child_process";
var jqRunner2 = spawnSync2;
async function tailLogs2(options) {
  const api = new QueryAPI;
  const config = loadConfig();
  const {
    follow,
    interval,
    format,
    jq,
    sources: multiSourceOption,
    fields: rawFields,
    ...remainingOptions
  } = options;
  const queryOptions = {
    ...remainingOptions
  };
  const normalizedFields = normalizeFieldsOption2(rawFields);
  if (normalizedFields) {
    queryOptions.fields = normalizedFields;
  } else {
    delete queryOptions.fields;
  }
  const limit = normalizeLimit2(queryOptions.limit);
  queryOptions.limit = limit;
  const resolvedSource = resolveSourceAlias(queryOptions.source);
  if (resolvedSource) {
    queryOptions.source = resolvedSource;
  }
  const resolvedSources = new Set;
  if (resolvedSource) {
    resolvedSources.add(resolvedSource);
  }
  if (multiSourceOption?.length) {
    for (const candidate of multiSourceOption) {
      const resolved = resolveSourceAlias(candidate);
      if (resolved) {
        resolvedSources.add(resolved);
      }
    }
  }
  if (resolvedSources.size === 0) {
    const defaultSource = resolveSourceAlias(config.defaultSource);
    if (defaultSource) {
      resolvedSources.add(defaultSource);
    }
  }
  try {
    if (resolvedSources.size <= 1) {
      if (resolvedSources.size === 1) {
        queryOptions.source = [...resolvedSources][0];
      }
      if (queryOptions.source === undefined) {
        queryOptions.source = resolvedSource;
      }
      await runSingleSource2(api, queryOptions, { follow, interval, format, jq });
      return;
    }
    queryOptions.source = undefined;
    await runMultiSource2(api, queryOptions, { follow, interval, format, jq }, [...resolvedSources]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(source_default2.red(`Tail error: ${message}`));
    process.exit(1);
  }
}
async function runSingleSource2(api, options, runtime) {
  const outputFormat = resolveFormat2(runtime.format, runtime.jq);
  let lastTimestamp = null;
  const results = await api.execute(options);
  if (results.length > 0) {
    printResults2(results, outputFormat, runtime.jq);
    lastTimestamp = results[0].dt;
  }
  if (!runtime.follow) {
    return;
  }
  console.error(source_default2.gray(`
Following logs... (Press Ctrl+C to stop)`));
  const intervalMs = resolveInterval2(runtime.interval);
  const pollLimit = Math.max(1, Math.min(50, options.limit ?? 50));
  const sinceFallback = options.since ?? "1m";
  setInterval(async () => {
    try {
      const pollOptions = {
        ...options,
        limit: pollLimit,
        since: lastTimestamp || sinceFallback
      };
      const newResults = await api.execute(pollOptions);
      if (newResults.length === 0) {
        return;
      }
      const previousTimestamp = lastTimestamp;
      const filtered = previousTimestamp ? newResults.filter((entry) => entry.dt > previousTimestamp) : newResults;
      if (filtered.length === 0) {
        return;
      }
      printResults2(filtered, outputFormat, runtime.jq);
      lastTimestamp = filtered[0].dt;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(source_default2.red(`Polling error: ${message}`));
    }
  }, intervalMs);
  process.stdin.resume();
}
async function runMultiSource2(api, baseOptions, runtime, sources) {
  const outputFormat = resolveFormat2(runtime.format, runtime.jq);
  const limit = baseOptions.limit ?? 100;
  const perSourceLatest = new Map;
  const collect = async (sinceMap, limitOverride, fallbackSince2) => {
    const limitPerSource = Math.max(1, limitOverride ?? limit);
    const combined = [];
    const latestBySource2 = new Map;
    for (const source of sources) {
      const perSourceOptions = {
        ...baseOptions,
        source,
        limit: limitPerSource
      };
      const sinceCandidate = sinceMap?.get(source) ?? baseOptions.since ?? fallbackSince2;
      perSourceOptions.since = sinceCandidate || undefined;
      const result = await api.execute(perSourceOptions);
      if (result.length > 0) {
        latestBySource2.set(source, result[0].dt);
        for (const entry of result) {
          combined.push({ ...entry, source });
        }
      }
    }
    combined.sort((a, b) => {
      if (a.dt === b.dt) {
        return 0;
      }
      return a.dt < b.dt ? 1 : -1;
    });
    return {
      combined: combined.slice(0, limitPerSource),
      latestBySource: latestBySource2
    };
  };
  const { combined: initialCombined, latestBySource } = await collect();
  for (const [source, dt] of latestBySource) {
    perSourceLatest.set(source, dt);
  }
  if (initialCombined.length > 0) {
    printResults2(initialCombined, outputFormat, runtime.jq);
  }
  if (!runtime.follow) {
    return;
  }
  console.error(source_default2.gray(`
Following logs... (Press Ctrl+C to stop)`));
  const intervalMs = resolveInterval2(runtime.interval);
  const pollLimit = Math.max(1, Math.min(50, limit));
  const fallbackSince = baseOptions.since ? undefined : "1m";
  setInterval(async () => {
    try {
      const { combined, latestBySource: followLatest } = await collect(perSourceLatest, pollLimit, fallbackSince);
      if (combined.length > 0) {
        const newEntries = combined.filter((entry) => {
          const previous = perSourceLatest.get(entry.source);
          return !previous || entry.dt > previous;
        });
        if (newEntries.length > 0) {
          printResults2(newEntries, outputFormat, runtime.jq);
        }
      }
      for (const [source, dt] of followLatest) {
        const previous = perSourceLatest.get(source);
        if (!previous || dt > previous) {
          perSourceLatest.set(source, dt);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(source_default2.red(`Polling error: ${message}`));
    }
  }, intervalMs);
  process.stdin.resume();
}
function resolveFormat2(format, jqFilter) {
  if (jqFilter) {
    return "json";
  }
  if (format === "json" || format === "table" || format === "csv" || format === "pretty") {
    return format;
  }
  return "pretty";
}
function resolveInterval2(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 2000;
}
function normalizeLimit2(limit) {
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return Math.floor(limit);
  }
  return 100;
}
function normalizeFieldsOption2(fields) {
  if (!fields) {
    return;
  }
  const rawValues = Array.isArray(fields) ? fields : [fields];
  const names = rawValues.flatMap((value) => value.split(",")).map((name) => name.trim()).filter((name) => name.length > 0);
  if (names.length === 0) {
    return;
  }
  return Array.from(new Set(names));
}
function printResults2(entries, format, jqFilter) {
  const payload = formatOutput(entries, format);
  if (!jqFilter) {
    console.log(payload);
    return;
  }
  try {
    const result = jqRunner2("jq", [jqFilter], {
      input: payload,
      encoding: "utf8"
    });
    if (result.error) {
      console.error(source_default2.red(`jq execution failed: ${result.error.message}`));
      console.log(payload);
      return;
    }
    if (result.status !== 0) {
      const stderr = result.stderr?.trim();
      if (stderr) {
        console.error(source_default2.red(`jq exited with status ${result.status}: ${stderr}`));
      } else {
        console.error(source_default2.red(`jq exited with status ${result.status}`));
      }
      console.log(payload);
      return;
    }
    const output = result.stdout ?? "";
    process.stdout.write(output);
    if (!output.endsWith(`
`)) {
      process.stdout.write(`
`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(source_default2.red(`jq integration error: ${message}`));
    console.log(payload);
  }
}

// src/commands/trace.ts
async function traceRequest(requestId, options, executor = tailLogs2) {
  const where = options.where ? { ...options.where } : {};
  where.requestId = requestId;
  await executor({
    ...options,
    where
  });
}

// src/utils/options.ts
function normalizeSourcesOption(input) {
  if (!input) {
    return;
  }
  const rawValues = Array.isArray(input) ? input : [input];
  const names = rawValues.flatMap((value) => value.split(",")).map((name) => name.trim()).filter((name) => name.length > 0);
  if (names.length === 0) {
    return;
  }
  return Array.from(new Set(names));
}
function parseLimitOption(rawValue) {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return Math.floor(rawValue);
  }
  if (typeof rawValue === "string") {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return;
}
function parseWhereOption(input) {
  if (!input) {
    return;
  }
  const rawValues = Array.isArray(input) ? input : [input];
  const where = {};
  for (const raw of rawValues) {
    if (!raw) {
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key) {
      continue;
    }
    let valueString = trimmed.slice(equalsIndex + 1).trim();
    if (valueString && valueString.length >= 2) {
      const firstChar = valueString[0];
      const lastChar = valueString[valueString.length - 1];
      if (firstChar === '"' && lastChar === '"' || firstChar === "'" && lastChar === "'") {
        valueString = valueString.slice(1, -1);
      }
    }
    const parsedValue = parseWhereValue(valueString);
    where[key] = parsedValue;
  }
  return Object.keys(where).length > 0 ? where : undefined;
}
function parseWhereValue(value) {
  if (value === undefined) {
    return;
  }
  if (value.length === 0) {
    return "";
  }
  const lower = value.toLowerCase();
  if (lower === "null") {
    return null;
  }
  if (lower === "true") {
    return true;
  }
  if (lower === "false") {
    return false;
  }
  if (/^-?\d+$/.test(value)) {
    const asNumber = Number.parseInt(value, 10);
    if (!Number.isNaN(asNumber)) {
      return asNumber;
    }
  }
  if (/^-?\d*\.\d+$/.test(value)) {
    const asFloat = Number.parseFloat(value);
    if (!Number.isNaN(asFloat)) {
      return asFloat;
    }
  }
  if (value.startsWith("{") && value.endsWith("}") || value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value);
    } catch {}
  }
  return value;
}
function resolveRuntimeOptions(options) {
  const limit = parseLimitOption(options.limit);
  const sources = normalizeSourcesOption(options.sources);
  const where = parseWhereOption(options.where);
  const jq = typeof options.jq === "string" && options.jq.trim().length > 0 ? options.jq.trim() : undefined;
  return {
    limit,
    sources,
    where,
    jq
  };
}

// src/utils/command-factory.ts
var collectWhereFilters = (value, previous = []) => [
  ...previous,
  value
];
function registerLogCommand(program2, config) {
  const command = program2.command(config.name);
  command.description(config.description);
  if (config.arguments) {
    for (const arg of config.arguments) {
      command.argument(arg.declaration, arg.description);
    }
  }
  applySharedLogOptions(command);
  if (config.setup) {
    config.setup(command);
  }
  command.action(async (...rawArgs) => {
    const options = rawArgs.pop();
    const commandOptions = options;
    const plainOptions = typeof commandOptions.opts === "function" ? commandOptions.opts() : options;
    const runtime = resolveRuntimeOptions(plainOptions);
    const filteredOptions = stripRuntimeOptionProps(plainOptions);
    await config.handler({
      args: rawArgs,
      runtime,
      options: filteredOptions
    });
  });
  return command;
}
function mergeWithRuntime(options, runtime, extras = {}) {
  const merged = {
    ...options,
    ...extras
  };
  if (runtime.limit !== undefined) {
    merged.limit = runtime.limit;
  }
  if (runtime.sources && runtime.sources.length > 0) {
    merged.sources = runtime.sources;
  }
  if (runtime.where && Object.keys(runtime.where).length > 0) {
    merged.where = runtime.where;
  }
  if (runtime.jq) {
    merged.jq = runtime.jq;
  }
  return merged;
}
function applySharedLogOptions(command) {
  command.option("-n, --limit <number>", "Number of logs to fetch", "100").option("--since <time>", "Time lower bound (e.g., 1h, 2d, 2024-01-01)").option("--until <time>", "Time upper bound (e.g., 2024-01-01T12:00)").option("--format <type>", "Output format (json|table|csv|pretty)", "pretty").option("--fields <names>", "Comma-separated list of fields to select (e.g., dt,message,level)").option("--sources <names>", "Comma-separated list of sources to merge").option("--where <filter...>", "Filter JSON fields (field=value). Repeat to add multiple filters", collectWhereFilters, []).option("--jq <filter>", "Pipe JSON output through jq (requires jq in PATH)").option("-v, --verbose", "Show SQL query and debug information");
}
function stripRuntimeOptionProps(options) {
  const { limit: _limit, sources: _sources, where: _where, jq: _jq, ...rest } = options;
  return rest;
}

// src/index.ts
try {
  const fs = __require("fs");
  const path = __require("path");
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    envContent.split(`
`).forEach((line) => {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value.replace(/^["']|["']$/g, "");
        }
      }
    });
  }
} catch {}
var program2 = new Command;
var cliVersion = typeof package_default.version === "string" ? package_default.version : "0.0.0";
program2.name("bslog").description("Better Stack log query CLI with GraphQL-inspired syntax").version(cliVersion);
function extractStringOption(options, key) {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}
program2.command("query").argument("<query>", "GraphQL-like query string").option("-s, --source <name>", "Source name").option("-f, --format <type>", "Output format (json|table|csv|pretty)", "pretty").option("-v, --verbose", "Show SQL query and debug information").description("Query logs using GraphQL-like syntax").action(async (query, options) => {
  await runQuery(query, options);
});
program2.command("sql").argument("<sql>", "Raw ClickHouse SQL query").option("-f, --format <type>", "Output format (json|table|csv|pretty)", "json").option("-v, --verbose", "Show SQL query and debug information").description("Execute raw ClickHouse SQL query").action(async (sql, options) => {
  await runSql(sql, options);
});
registerLogCommand(program2, {
  name: "tail",
  description: `Tail logs (similar to tail -f)
Examples:
  bslog tail                    # use default source
  bslog tail sweetistics-dev    # use specific source
  bslog tail prod -n 50         # tail production logs`,
  arguments: [{ declaration: "[source]", description: "Source name or alias" }],
  setup: (cmd) => {
    cmd.option("-l, --level <level>", "Filter by log level").option("--subsystem <name>", "Filter by subsystem").option("-f, --follow", "Follow log output").option("--interval <ms>", "Polling interval in milliseconds", "2000");
  },
  handler: async ({ args, runtime, options }) => {
    const [sourceArg] = args;
    const sourceOption = extractStringOption(options, "source");
    const merged = mergeWithRuntime(options, runtime, {
      source: sourceArg ?? sourceOption
    });
    await tailLogs(merged);
  }
});
registerLogCommand(program2, {
  name: "errors",
  description: `Show only error logs
Examples:
  bslog errors                  # use default source
  bslog errors sweetistics-dev  # errors from dev
  bslog errors prod --since 1h  # recent prod errors`,
  arguments: [{ declaration: "[source]", description: "Source name or alias" }],
  handler: async ({ args, runtime, options }) => {
    const [sourceArg] = args;
    const sourceOption = extractStringOption(options, "source");
    const merged = mergeWithRuntime(options, runtime, {
      source: sourceArg ?? sourceOption
    });
    await showErrors(merged);
  }
});
registerLogCommand(program2, {
  name: "warnings",
  description: "Show only warning logs",
  arguments: [{ declaration: "[source]", description: "Source name or alias" }],
  handler: async ({ args, runtime, options }) => {
    const [sourceArg] = args;
    const sourceOption = extractStringOption(options, "source");
    const merged = mergeWithRuntime(options, runtime, {
      source: sourceArg ?? sourceOption
    });
    await showWarnings(merged);
  }
});
registerLogCommand(program2, {
  name: "search",
  description: `Search logs for a pattern
Examples:
  bslog search "error"                    # search in default source
  bslog search "error" sweetistics-dev    # search in dev
  bslog search "timeout" prod --since 1h  # search recent prod logs`,
  arguments: [
    { declaration: "<pattern>", description: "Substring or expression to search for" },
    { declaration: "[source]", description: "Source name or alias" }
  ],
  setup: (cmd) => {
    cmd.option("-l, --level <level>", "Filter by log level");
  },
  handler: async ({ args, runtime, options }) => {
    const [pattern, sourceArg] = args;
    const sourceOption = extractStringOption(options, "source");
    const merged = mergeWithRuntime(options, runtime, {
      source: sourceArg ?? sourceOption
    });
    await searchLogs(pattern, merged);
  }
});
registerLogCommand(program2, {
  name: "trace",
  description: "Fetch all logs sharing a requestId across one or more sources",
  arguments: [
    { declaration: "<requestId>", description: "Request identifier to trace" },
    { declaration: "[source]", description: "Source name or alias" }
  ],
  handler: async ({ args, runtime, options }) => {
    const [requestId, sourceArg] = args;
    const sourceOption = extractStringOption(options, "source");
    const merged = mergeWithRuntime(options, runtime, {
      source: sourceArg ?? sourceOption
    });
    await traceRequest(requestId, merged);
  }
});
var sources = program2.command("sources").description("Manage log sources");
sources.command("list").option("-f, --format <type>", "Output format (json|table|pretty)", "pretty").description("List all available sources").action(async (options) => {
  await listSources(options);
});
sources.command("get").argument("<name>", "Source name").option("-f, --format <type>", "Output format (json|pretty)", "pretty").description("Get details about a specific source").action(async (name, options) => {
  await getSource(name, options);
});
var config = program2.command("config").description("Manage configuration");
config.command("set").argument("<key>", "Configuration key (source|limit|format|logLevel|queryBaseUrl)").argument("<value>", "Configuration value").description("Set a configuration value").action((key, value) => {
  setConfig(key, value);
});
config.command("show").option("-f, --format <type>", "Output format (json|pretty)", "pretty").description("Show current configuration").action((options) => {
  showConfig(options);
});
config.command("source").argument("<name>", "Source name").description("Set default source (shorthand for config set source)").action((name) => {
  setConfig("source", name);
});
program2.on("--help", () => {
  console.log("");
  console.log(source_default.bold("Examples:"));
  console.log("");
  console.log("  # GraphQL-like queries:");
  console.log('  $ bslog query "{ logs(limit: 100) { dt, level, message } }"');
  console.log(`  $ bslog query "{ logs(level: 'error', since: '1h') { * } }"`);
  console.log(`  $ bslog query "{ logs(where: { subsystem: 'api' }) { dt, message } }"`);
  console.log("");
  console.log("  # Simple commands:");
  console.log("  $ bslog tail -n 50                    # Last 50 logs");
  console.log("  $ bslog tail -f                       # Follow logs");
  console.log("  $ bslog errors --since 1h             # Errors from last hour");
  console.log('  $ bslog search "authentication failed"');
  console.log('  $ bslog search "timeline" --where module=timeline --where env=production --until 2025-09-24T18:00');
  console.log("  $ bslog tail --format json --jq '.[] | {dt, message}'");
  console.log("");
  console.log("  # Sources:");
  console.log("  $ bslog sources list                  # List all sources");
  console.log("  $ bslog config source sweetistics-dev # Set default source");
  console.log("");
  console.log("  # Raw SQL:");
  console.log('  $ bslog sql "SELECT * FROM remote(t123_logs) LIMIT 10"');
  console.log("");
  console.log(source_default.bold("Authentication:"));
  console.log("  Requires environment variables for Better Stack API access:");
  console.log("  - BETTERSTACK_API_TOKEN        # For sources discovery");
  console.log("  - BETTERSTACK_QUERY_USERNAME   # For log queries");
  console.log("  - BETTERSTACK_QUERY_PASSWORD   # For log queries");
  console.log("");
  console.log("  Add to ~/.zshrc (or ~/.bashrc) then reload with:");
  console.log(source_default.dim("  $ source ~/.zshrc"));
});
program2.parse();
if (program2.args.length === 0) {
  program2.help();
}
