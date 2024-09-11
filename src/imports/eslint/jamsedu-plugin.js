/**
 * JamsEdu ESLint plugin that enforces proper template and variables usage when building with
 * JamsEdu layouts. This plugin piggybacks off the @html-hint/eslint-parser and does not have its own.
 */

// Helper functions for JamsEdu rules.
const containsZoneElement = (node) => {
    // Check if the current node is a <zone> element.
    if (node.type === 'Tag' && node.name === 'zone') {
        return true;
    }

    // If the node is a <template> element, do not recurse into its children.
    if (node.type === 'Tag' && node.name === 'template') {
        return false;
    }

    // If the node has children, recursively check each one
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            if (containsZoneElement(child)) {
                return true; // Stop and return true as soon as a <zone> is found.
            }
        }
    }

    // If no <zone> element is found in this branch, return false.
    return false;
};

const getOpeningTagLocObj = (node) => ({
    start: {
        line: node.openStart.loc.start.line,
        column: node.openStart.loc.start.column
    },
    end: {
        line: node.openEnd.loc.end.line,
        column: node.openEnd.loc.end.column
    }
});

const isNonEmptyText = (node) => node.type === 'Text' && node.value.trim().length > 0;

const isTitle = (node) => node.type === 'Tag' && node.name === 'title';

const isVarNode = (node) => {
    if (node.type !== 'Tag' && node.name !== 'var') {
        return false;
    }

    if (node.children.length === 0) {
        return false;
    }

    return node.children.every(isNonEmptyText);
};

const isWithin = (node, name) => {
    while (node) {
        if (node.type === 'Tag' && node.name === name) {
            return true;
        }
        // eslint-disable-next-line no-param-reassign
        node = node.parent;  // Move up to the parent node.
    }
    return false;
};

/**
 * JamsEdu specific title rule (@jamsedu/require-title) that allows <var> tags inside the pages
 * <title> tag. Replaces the @html-hint/require-title rule.
 */
const JamsEduTitleRule = {
    meta: {
        type: 'code',
        docs: {
            description: 'Require `<title><title/>` in the `<head><head/>`',
            category: 'SEO',
            recommended: true
        },
        fixable: null,
        schema: [],
        messages: {
            missing: 'Missing `<title><title/>` in the `<head><head/>`',
            empty: 'Unexpected empty text in `<title><title/>`'
        }
    },
    create(context) {
        return {
            Tag(node) {
                if (node.name !== 'head') {
                    return;
                }

                const title = node.children.find(isTitle);

                if (!title) {
                    context.report({
                        node,
                        messageId: 'missing'
                    });
                    return;
                }

                const hasVarElement = title.children.some(isVarNode);
                const allTextNodes = title.children.every(isNonEmptyText);
                const content = allTextNodes || hasVarElement;

                if (!content) {
                    context.report({
                        node: title,
                        messageId: 'empty'
                    });
                }
            }
        };
    }
};

/**
 * Adds template and variable rules to standard HTML to help users build JamsEdu layouts correctly.
 */
const JamsEduLayoutRules = {
    meta: {
        type: 'code',
        docs: {
            description: 'Require correct use of JamsEdu templates and variables.',
            category: 'Style',
            recommended: true
        },
        fixable: null,
        schema: [],
        messages: {
            namedTemplate: 'The `<template>` tag does not support the `name` attribute',
            nestedZone: '`<zone>` elements should not contain other `<zone>` elements',
            // eslint-disable-next-line max-len
            templateMissingUse: 'The `use` attribute is required for `<template>` tags that contain `<zone></zone>` elements',
            // eslint-disable-next-line max-len
            varUsedIncorrectly: 'If you are attempting to declare a variable you are missing the `name` attribute. If you are attempting to use a variable no other elements should be present within the `<var></var>` tags',
            zoneNotInTemplate: 'All `<zone name="...">` declarations should be within a `<template>` element',
            // eslint-disable-next-line max-len
            zoneUsedIncorrectly: 'If you are attempting to provide the content of a zone you are missing the `name` attribute. If you are attempting to apply the contents of a zone no other elements should be present within the `<zone></zone>` tags'
        }
    },
    create(context) {
        // Arrays to collect nodes of interest.
        const templateNodes = [];
        const varNodes = [];
        const zoneNodes = [];

        return {
            Tag(node) {
                if (!['template', 'var', 'zone'].includes(node.name)) {
                    return;
                }

                // Collect <template> nodes
                if (node.name === 'template') {
                    templateNodes.push(node);
                }

                // Collect <var> nodes
                if (node.name === 'var') {
                    varNodes.push(node);
                }

                // Collect <zone> nodes
                if (node.name === 'zone') {
                    zoneNodes.push(node);
                }
            },
            'Program:exit': () => {
                // Process <template> nodes.
                templateNodes.forEach((node) => {
                    // Check if template contains the `name` attribute.
                    if (node.attributes.some((attr) => attr.key.value === 'name')) {
                        context.report({
                            loc: getOpeningTagLocObj(node), // Limit the error highlighting to the opening tag.
                            messageId: 'namedTemplate'
                        });
                    }

                    // Check if template should contain the `use` attribute and its missing.
                    const containsZone = node.children.some(containsZoneElement);
                    if (containsZone && !node.attributes.some((attr) => attr.key.value === 'use')) {
                        context.report({
                            loc: getOpeningTagLocObj(node), // Limit the error highlighting to the opening tag.
                            messageId: 'templateMissingUse'
                        });
                    }
                });

                // Process <var> nodes.
                varNodes.forEach((node) => {
                    if (node.attributes.some((attr) => attr.key.value === 'name')) {
                        return;
                    }

                    if (!node.children.every(isNonEmptyText)) {
                        context.report({
                            node,
                            messageId: 'varUsedIncorrectly'
                        });
                    }
                });

                // Process <zone> nodes.
                zoneNodes.forEach((node) => {
                    // No zone should be nested within another zone.
                    if (isWithin(node.parent, 'zone')) {
                        context.report({
                            node,
                            messageId: 'nestedZone'
                        });
                    }

                    if (node.attributes.some((attr) => attr.key.value === 'name')) {
                        // Check that the <zone> is within a <template>; only required when being declared (used).
                        if (!isWithin(node.parent, 'template')) {
                            context.report({
                                node,
                                messageId: 'zoneNotInTemplate'
                            });
                        }
                        return;
                    }

                    if (!node.children.every(isNonEmptyText)) {
                        context.report({
                            node,
                            messageId: 'zoneUsedIncorrectly'
                        });
                    }
                });
            }
        };
    }
};

// The JamsEdu plugin to register with ESLint.
export default {
    rules: {
        'require-title': JamsEduTitleRule,
        'templates-and-variables': JamsEduLayoutRules
    }
};
