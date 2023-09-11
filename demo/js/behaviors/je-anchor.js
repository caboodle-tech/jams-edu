class JamsEduAnchor {

    #EL;

    constructor(elem) {
        this.#EL = elem;
    }

    connectedCallback() {
        if (this.#EL.id) {
            const loc = document.location;
            let url = loc.origin + loc.pathname;
            if (loc.search) {
                url += loc.search;
            }
            const options = {
                attrs: {
                    href: `${url}#${this.#EL.id}`
                },
                innerHTML: JamsEduIcon.get('link')
            };
            this.#EL.appendChild(JamsEdu.createElement('a', options));
        }
    }

}

elementBehaviors.define('je-anchor', JamsEduAnchor);
