import * as vscode from "vscode";

/**
 * Generates a Dart data class with a specified suffix and naming style.
 * Supports enums and custom serialization through comments.
 */
export const dataClass = async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showErrorMessage("No active editor found.");
  }

  const selection = editor.selection;
  let classCode =
    editor.document.getText(selection).trim() || editor.document.getText();

  const suffix =
    (
      await vscode.window.showInputBox({
        prompt: "Enter class suffix (e.g., 'DTO' or leave empty)",
      })
    )?.trim() ?? "";

  const namingStyle = await vscode.window.showQuickPick(
    ["camelCase", "snake_case", "PascalCase", "kebab-case", "original"],
    { placeHolder: "Select the field naming style" }
  );

  if (!namingStyle) {
    return vscode.window.showErrorMessage("No naming style selected.");
  }

  const convertCase = {
    camelCase: (str: string) =>
      str.replace(/_./g, (s) => s.charAt(1).toUpperCase()),
    snake_case: (str: string) =>
      str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase(),
    PascalCase: (str: string) =>
      str.replace(/(^\w|_\w)/g, (s: string) =>
        s.replace("_", "").toUpperCase()
      ),
    "kebab-case": (str: string) =>
      str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase(),
    original: (str: any) => str,
  }[namingStyle];

  const classNameMatch = classCode.match(/class\s+(\w+)/);
  if (!classNameMatch) {
    return vscode.window.showErrorMessage("No valid Dart class found.");
  }

  const className = classNameMatch[1];
  const dtoClassName = `${className}${suffix}`;

  const dartBuiltInTypes = new Set([
    "int",
    "double",
    "String",
    "bool",
    "num",
    "List",
    "Map",
    "Set",
    "dynamic",
  ]);

  // Function to determine field type based on comments or class content
  const determineFieldType = (
    type: string,
    name: string,
    classCode: string
  ) => {
    const cleanType = type.replace("?", "");
    let isEnum = false;
    let customParsing: { fromJson?: string; toJson?: string } = {};

    // Check for comments (Enum and Custom Serialization)
    const commentRegex = new RegExp(`${name};\\s*//\\s*(.+)`, "g");
    const commentMatch = commentRegex.exec(classCode);

    if (commentMatch) {
      const commentLines = commentMatch[1]
        .split("\n")
        .map((line) => line.trim());
      for (const line of commentLines) {
        if (line.startsWith("Type: enum")) {
          isEnum = true;
        } else if (line.startsWith("Parsing:")) {
          const match = line.match(/Parsing:\s*(.*),\s*(.*)/);
          if (match) {
            customParsing.fromJson = match[1].trim();
            customParsing.toJson = match[2].trim();
          }
        }
      }
    }

    if (dartBuiltInTypes.has(cleanType)) {
      return { isEnum: false, isClass: false, customParsing };
    }

    return { isEnum, isClass: !isEnum, customParsing };
  };

  const fieldMatches = [...classCode.matchAll(/(\w+\??)\s+(\w+);/g)];
  if (!fieldMatches.length) {
    return vscode.window.showErrorMessage("No valid fields found in class.");
  }

  let fields = fieldMatches.map(([_, type, name]) => {
    const { isEnum, isClass, customParsing } = determineFieldType(
      type,
      name,
      classCode
    );

    return {
      type,
      name,
      snakeName: convertCase ? convertCase(name) : name,
      nullable: type.endsWith("?"),
      isEnum,
      isClass,
      customParsing,
    };
  });

  const generateFieldDeclarations = () =>
    fields.map(({ type, name }) => `final ${type} ${name};`).join("\n  ");

  const generateConstructor = () => `
  const ${dtoClassName}({
    ${fields
      .map(
        ({ name, nullable }) => `${nullable ? "" : "required "}this.${name},`
      )
      .join("\n    ")}
  });
  `;

  const generateFactoryMethods =
    () => `factory ${dtoClassName}.fromMap(Map<String, dynamic> map) => ${dtoClassName}(
    ${fields
      .map(({ type, name, snakeName, customParsing, isEnum, isClass }) => {
        if (customParsing.fromJson) {
          return `${name}: ${customParsing.fromJson.replace(
            "value",
            `map['${snakeName}']`
          )},`;
        }
        if (isEnum) {
          return `${name}: ${name}FromString(map['${snakeName}']),`;
        }
        if (isClass) {
          return `${name}: map['${snakeName}'] != null ? ${type}.fromMap(map['${snakeName}']) : null,`;
        }
        return `${name}: map['${snakeName}'],`;
      })
      .join("\n    ")}
      );

  factory ${dtoClassName}.fromJson(String source) =>
      ${dtoClassName}.fromMap(json.decode(source));
  `;

  const generateToMapAndJson = () => `Map<String, dynamic> toMap() => {
    ${fields
      .map(({ name, snakeName, customParsing, isEnum, isClass }) => {
        if (customParsing.toJson) {
          return `'${snakeName}': ${customParsing.toJson.replace(
            "value",
            name
          )},`;
        }
        if (isEnum) {
          return `'${snakeName}': ${name}ToString(${name}),`;
        }

        if (isClass) {
          return `'${snakeName}': ${name}?.toMap(),`;
        }
        return `'${snakeName}': ${name},`;
      })
      .join("\n    ")}
  };

  String toJson() => json.encode(toMap());`;

  const generateToString = () => `
  @override
  String toString() => '${dtoClassName}(${fields
    .map(({ name }) => `${name}: \$${name}`)
    .join(", ")})';`;

  const classTemplate = `
import 'dart:convert';
import 'package:meta/meta.dart';

@immutable
class ${dtoClassName} {
  ${generateFieldDeclarations()}
  ${generateConstructor()}
  ${generateFactoryMethods()}
  ${generateToMapAndJson()}
  ${generateToString()}
}

`;

  await editor.edit((editBuilder) => {
    editBuilder.replace(
      new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length)
      ),
      classTemplate.trim()
    );
  });
};
