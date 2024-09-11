import { greet } from './greet';
import config from './data.json';

const { name } = config;

export function sayHello(): void {
    console.log(greet(name));
}
