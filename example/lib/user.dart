import 'dart:convert';
import 'package:example/main.dart';
import 'package:meta/meta.dart';

@immutable
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
        count: map['count'] != null ? Count.fromMap(map['count']) : null,
        subType: map['subType'] != null ? SubType.fromMap(map['subType']) : null,
      );

  factory User.fromJson(String source) => User.fromMap(json.decode(source));

  Map<String, dynamic> toMap() => {
        'name': name,
        'count': count.toMap(),
        'subType': subType.toMap(),
      };

  String toJson() => json.encode(toMap());

  @override
  String toString() => 'User(name: $name, count: $count, subType: $subType)';
}
