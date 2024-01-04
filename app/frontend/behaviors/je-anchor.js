export default () => {
    class JamsEduAnchor {

        #elem;

        constructor(elem) {
            this.#elem = elem;
        }

        connectedCallback() {
            if (this.#elem.id) {
                const loc = document.location;
                let url = loc.origin + loc.pathname;
                if (loc.search) {
                    url += loc.search;
                }
                const options = {
                    attrs: {
                        href: `${url}#${this.#elem.id}`
                    },
                    innerHTML: JamsEduIcon.get('link')
                };
                this.#elem.appendChild(JamsEdu.createElement('a', options));
            }
        }

    }

    elementBehaviors.define('je-anchor', JamsEduAnchor);
};
