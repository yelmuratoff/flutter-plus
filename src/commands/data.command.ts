import * as vscode from "vscode";

/**
 * Generates a Dart data class with a specified suffix and naming style.
 * The function extracts the selected class from the active editor,
 * modifies its fields based on user preferences, and replaces the original class.
 */
export const dataClass = async () => {
  // Get the active text editor in VS Code
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showErrorMessage("No active editor found.");
  }

  // Get the selected text or the entire document if no text is selected
  const selection = editor.selection;
  let classCode =
    editor.document.getText(selection).trim() || editor.document.getText();

  // Prompt the user to enter a suffix for the generated class (e.g., "DTO")
  const suffix =
    (
      await vscode.window.showInputBox({
        prompt: "Enter class suffix (e.g., 'DTO' or leave empty)",
        value: "DTO",
      })
    )?.trim() ?? "";

  // Prompt the user to select a field naming style
  const namingStyle = await vscode.window.showQuickPick(
    ["camelCase", "snake_case", "PascalCase", "kebab-case", "original"],
    { placeHolder: "Select the field naming style" }
  );

  // If no naming style is selected, show an error message and exit
  if (!namingStyle) {
    return vscode.window.showErrorMessage("No naming style selected.");
  }

  // Mapping function for different naming styles
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

  // Extract the class name from the Dart code
  const classNameMatch = classCode.match(/class\s+(\w+)/);
  if (!classNameMatch) {
    return vscode.window.showErrorMessage("No valid Dart class found.");
  }

  const className = classNameMatch[1];
  const dtoClassName = `${className}${suffix}`;
  const hasEquatable = classCode.includes("Equatable");

  // Extract field declarations from the Dart class
  const fieldMatches = [...classCode.matchAll(/(\w+\??)\s+(\w+);/g)];
  if (!fieldMatches.length) {
    return vscode.window.showErrorMessage("No valid fields found in class.");
  }

  // Convert fields into structured objects with metadata
  let fields = fieldMatches.map(([_, type, name]) => ({
    type,
    name,
    snakeName: convertCase ? convertCase(name) : name,
    nullable: type.endsWith("?"),
  }));

  // Extract the constructor parameters to determine required fields
  const constructorMatch = classCode.match(
    new RegExp(`\b${className}\s*\(([^)]*)\)`, "s")
  );
  const constructorParams = constructorMatch?.[1]?.trim();

  // Update nullable status based on constructor parameters
  if (constructorParams) {
    fields = fields.map((field) => ({
      ...field,
      nullable: !new RegExp(`(required\s+)?this.${field.name}`).test(
        constructorParams
      ),
    }));
  }

  // Generate field declarations for the new class
  const generateFieldDeclarations = () =>
    fields.map(({ type, name }) => `  final ${type} ${name};`).join("\n");

  // Generate a constructor with required and optional parameters
  const generateConstructor = () => `
  const ${dtoClassName}({
    ${fields
      .map(
        ({ name, nullable }) => `${nullable ? "" : "required "}this.${name},`
      )
      .join("\n    ")}
  });
  `;

  // Generate factory methods for converting from Map and JSON
  const generateFactoryMethods = () => `
  factory ${dtoClassName}.fromMap(Map<String, dynamic> map,
   ) => ${dtoClassName}(
    ${fields
      .map(
        ({ type, name, snakeName, nullable }) =>
          `${name}: map['${snakeName}'] as ${type.replace("?", "")}${
            nullable ? "?" : ""
          },`
      )
      .join("")}
  );

  factory ${dtoClassName}.fromJson(String source) =>
      ${dtoClassName}.fromMap(
         json.decode(source) as Map<String, dynamic>,
      );
   `;

  // Generate a copyWith method to create modified copies of an instance
  const generateCopyWith = () => `${dtoClassName} copyWith({
    ${fields
      .map(
        ({ type, name }) => `${type.endsWith("?") ? type : `${type}?`} ${name},`
      )
      .join("\n    ")}
  }) => ${dtoClassName}(
    ${fields
      .map(({ name }) => `${name}: ${name} ?? this.${name},`)
      .join("\n    ")}
  );`;

  const generateToString = () => `@override
  String toString() => '${dtoClassName}(${fields
    .map(({ name }) => `${name}: \$${name}`)
    .join(", ")})';
`;

  // Generate methods for converting to Map and JSON
  const generateToMapAndJson = () => `
  Map<String, dynamic> toMap() => {
    ${fields
      .map(({ name, snakeName }) => `  '${snakeName}': ${name},`)
      .join("\n    ")}
  };

  String toJson() => json.encode(toMap(),);
  `;

  // Generate equality checks and hashCode methods
  const generateEquality = () =>
    hasEquatable
      ? `
  @override
  List<Object?> get props => [${fields.map(({ name }) => name).join(",")}];
  `
      : `
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ${dtoClassName} &&
      ${fields
        .map(({ name }) => `other.${name} == ${name} &&`)
        .join("\n      ")} true;

  @override
  int get hashCode => ${fields
    .map(({ name }) => `${name}.hashCode ^`)
    .join("\n      ")} 0;
  `;

  // Construct the final class template
  const classTemplate = `
import 'dart:convert';
${
  hasEquatable ? "import 'package:equatable/equatable.dart';\n" : ""
}import 'package:meta/meta.dart';

@immutable
class ${dtoClassName} ${hasEquatable ? "extends Equatable" : ""} {
${generateFieldDeclarations()}
${generateConstructor()}
${generateFactoryMethods()}
${generateCopyWith()}
${generateToMapAndJson()}
${generateToString()}
${generateEquality()}
}
`;

  // Replace the existing class in the editor with the generated class
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
