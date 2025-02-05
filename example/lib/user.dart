import 'dart:convert';

import 'package:example/main.dart';

class User {
  final String name;
  final Count count;
  final SubType subType;

  const User({
    required this.name,
    required this.count,
    required this.subType,
  });

  factory User.fromMap(Map<String, dynamic> map) => User(
        name: map['name'],
        count: Count.fromString(map['count']),
        subType: SubType.fromJsonCustom(map['subType']),
      );

  factory User.fromJson(String source) => User.fromMap(json.decode(source));

  Map<String, dynamic> toMap() => {
        'name': name,
        'count': Count.serialize(count),
        'subType': SubType.toJsonCustom(subType),
      };

  String toJson() => json.encode(toMap());

  @override
  String toString() => 'User(name: $name, count: $count, subType: $subType)';
}
