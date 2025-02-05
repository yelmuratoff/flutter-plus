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

  const classRegex = /class\s+(\w+)\s*{([\s\S]*?)}/g;
  let classMatch;
  let updatedClassCode = classCode;
  let edits: { range: vscode.Range; newText: string }[] = [];

  while ((classMatch = classRegex.exec(classCode)) !== null) {
    const className = classMatch[1];
    const classBody = classMatch[2];
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

    const determineFieldType = (
      type: string,
      name: string,
      classBody: string
    ) => {
      const cleanType = type.replace("?", "");
      let isEnum = false;
      let customParsing: { fromJson?: string; toJson?: string } = {};

      const commentRegex = new RegExp(`${name};\\s*//\\s*(.+)`, "g");
      const commentMatch = commentRegex.exec(classBody);

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

    const fieldMatches = [...classBody.matchAll(/(\w+\??)\s+(\w+);/g)];
    if (!fieldMatches.length) {
      vscode.window.showErrorMessage(
        `No valid fields found in class ${className}.`
      );
      continue;
    }

    let fields = fieldMatches.map(([_, type, name]) => {
      const { isEnum, isClass, customParsing } = determineFieldType(
        type,
        name,
        classBody
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

    const generateFactoryMethods = () => `
  factory ${dtoClassName}.fromMap(Map<String, dynamic> map) => ${dtoClassName}(
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

    const generateToMapAndJson = () => `
  Map<String, dynamic> toMap() => {
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

  String toJson() => json.encode(toMap());
  `;

    const generateToString = () => `
  @override
  String toString() => '${dtoClassName}(${fields
      .map(({ name }) => `${name}: \$${name}`)
      .join(", ")})';
  `;

    const updatedClass = `
class ${dtoClassName} {
  ${generateFieldDeclarations()}
  ${generateConstructor()}
  ${generateFactoryMethods()}
  ${generateToMapAndJson()}
  ${generateToString()}
}
`;

    const start = editor.document.positionAt(classMatch.index);
    const end = editor.document.positionAt(
      classMatch.index + classMatch[0].length
    );
    edits.push({
      range: new vscode.Range(start, end),
      newText: updatedClass.trim(),
    });
  }

  if (edits.length === 0) {
    return vscode.window.showErrorMessage("No Dart class found to update.");
  }

  await editor.edit((editBuilder) => {
    for (const edit of edits) {
      editBuilder.replace(edit.range, edit.newText);
    }
  });
};
