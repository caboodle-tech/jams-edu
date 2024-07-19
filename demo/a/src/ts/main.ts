/**
 * @jamsedu iife js/main.js
 */

function sayHello() {
    console.log("Hello, world!");
}

sayHello();

function addNumbers(a: number, b: number): number {
    return a + b;
}

const result = addNumbers(5, 3);

console.log(result); // Output: 8