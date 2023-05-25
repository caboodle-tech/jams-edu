class JamsEdu {

    constructor() {
    }

    createElement(tag, options = {}) {
        const attrs = options.attrs;
        const classes = options.classes;
        const id = options.id;
        const innerHTML = options.innerHTML;
        const listeners = options.listeners;
        let elem = document.createElement(tag);
        if (attrs) {
            if (this.isObject(attrs)) {
                Object.keys(attrs).forEach((attr) => {
                    elem.setAttribute(attr, attrs[attr]);
                });
            }
        }
        if (classes) {
            const tokens = classes.replace(/,/g, ' ').replace(/\s\s+/g).trim();
            tokens.split(' ').forEach((token) => {
                elem.classList.add(token);
            });
        }
        if (id) {
            elem.id = id;
        }
        if (innerHTML) {
            elem.innerHTML = innerHTML;
        }
        if (listeners) {
            if (Array.isArray(listeners)) {
                listeners.forEach((listener) => {
                    elem.addEventListener(listener[0], listener[1]);
                });
            }
        }
        return elem;
    }

    isObject(check) {
        if (typeof check === 'object' && !Array.isArray(check) && check !== null) {
            return true;
        }
        return false
    }

}

JamsEdu = new JamsEdu();
window.JamsEdu = JamsEdu;