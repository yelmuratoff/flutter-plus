import 'dart:convert';
import 'package:meta/meta.dart';

@immutable
class UserDTO  {
  final String name;

  const UserDTO({
    required this.name,
  });
  

  factory UserDTO.fromMap(Map<String, dynamic> map,
   ) => UserDTO(
    name: map['name'] as String,
  );

  factory UserDTO.fromJson(String source) =>
      UserDTO.fromMap(
         json.decode(source) as Map<String, dynamic>,
      );
UserDTO copyWith({
    String? name,
  }) => UserDTO(
    name: name ?? this.name,
  );

  Map<String, dynamic> toMap() => {
      'name': name,
  };

  String toJson() => json.encode(toMap(),);
@override
  String toString() => 'UserDTO(name: $name)';


  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UserDTO &&
      other.name == name && true;

  @override
  int get hashCode => name.hashCode ^ 0;
  
}