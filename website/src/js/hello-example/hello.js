import Greet from './greet.js';
import Config from './data.json';

const { name } = Config;

export default () => {
    console.log(Greet(name));
};
