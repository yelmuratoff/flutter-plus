import 'package:flutter/material.dart';

enum Count { one, two, three }

class SubType {
  final String name;
  final Count count;

  SubType(this.name, this.count);
}

void main() {
  runApp(const MainApp());
}

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: Scaffold(
        body: Center(
          child: Text('Hello World!'),
        ),
      ),
    );
  }
}
