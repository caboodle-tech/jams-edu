--- Archived 2026-05: previous Pandoc Lua handlers for JamsEDU fenced divs on the Quarto intermediate markdown path.
--- Rendering for these blocks now runs in `src/jamsedu.js` (extract before fragment Pandoc, merge after).
--- Kept for reference; the active `jamsedu-blocks.lua` is a no-op filter.

--- Unified fenced-div handlers for Quarto `.qmd` authoring.
--- Used for both Quarto intermediate markdown → HTML (Jams fragment Pandoc) and the preserve-batch pass in jamsedu.js.
--- Supported classes: jams-pdf, jams-video, jams-mermaid, jams-diagram,
--- jams-katex, jams-math, jams-document, jams-rich.
---
--- jams-document / jams-rich: bare HTML inside `:::` may be wrapped in ` ```{=html}` … ` ``` ` by JamsEDU before Quarto when missing (same policy; extend `optionalInnerHtmlFenceDivClasses` in jamsedu.js). For jams-rich, after Quarto the
--- body may arrive as merged HTML plus native blocks; we serialize with `pandoc.write` to HTML seed. Entities escape
--- the textarea payload so markup is legal in the embedding page; the browser restores HTML in `textarea.value`.

local function has_class(attr, class_name)
    for _, cls in ipairs(attr.classes or {}) do
        if cls == class_name then
            return true
        end
    end
    return false
end

local function escape_html_text(value)
    return tostring(value or '')
        :gsub('&', '&amp;')
        :gsub('<', '&lt;')
        :gsub('>', '&gt;')
end

local function escape_html_attribute(value)
    return escape_html_text(value)
        :gsub('"', '&quot;')
end

local function blocks_to_plain_text(blocks)
    local text = pandoc.utils.stringify(pandoc.Blocks(blocks or {}))
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text
end

local function blocks_to_markdown(blocks)
    local markdown = pandoc.write(pandoc.Pandoc(blocks or {}), 'markdown')
    markdown = markdown:gsub('^%s+', ''):gsub('%s+$', '')
    return markdown
end

local function inlines_to_formula_text(inlines)
    local parts = {}
    for _, inline in ipairs(inlines or {}) do
        if inline.t == 'RawInline' and inline.format == 'tex' then
            parts[#parts + 1] = inline.text
        elseif inline.t == 'Str' then
            parts[#parts + 1] = inline.text
        elseif inline.t == 'Space' or inline.t == 'SoftBreak' or inline.t == 'LineBreak' then
            parts[#parts + 1] = ' '
        elseif inline.t == 'Code' then
            parts[#parts + 1] = inline.text
        else
            parts[#parts + 1] = pandoc.utils.stringify(inline)
        end
    end
    local s = table.concat(parts, '')
    s = s:gsub('%{%=tex%}', '')
    s = s:gsub('%s+', ' ')
    return s:gsub('^%s+', ''):gsub('%s+$', '')
end

local function blocks_to_formula_text(blocks)
    local parts = {}
    for _, blk in ipairs(blocks or {}) do
        if blk.t == 'Para' or blk.t == 'Plain' then
            parts[#parts + 1] = inlines_to_formula_text(blk.content)
        elseif blk.t == 'CodeBlock' then
            parts[#parts + 1] = blk.text or ''
        else
            parts[#parts + 1] = pandoc.utils.stringify(blk)
        end
    end
    local s = table.concat(parts, '\n')
    s = s:gsub('%s+\n', '\n')
    return s:gsub('^%s+', ''):gsub('%s+$', '')
end

local function inlines_to_text_preserve_breaks(inlines)
    local parts = {}
    for _, inline in ipairs(inlines or {}) do
        if inline.t == 'RawInline' then
            parts[#parts + 1] = inline.text
        elseif inline.t == 'Code' then
            parts[#parts + 1] = inline.text
        elseif inline.t == 'Str' then
            parts[#parts + 1] = inline.text
        elseif inline.t == 'Space' then
            parts[#parts + 1] = ' '
        elseif inline.t == 'SoftBreak' or inline.t == 'LineBreak' then
            parts[#parts + 1] = '\n'
        else
            parts[#parts + 1] = pandoc.utils.stringify(inline)
        end
    end
    local s = table.concat(parts, '')
    s = s:gsub('[ \t]+\n', '\n')
    return s:gsub('^%s+', ''):gsub('%s+$', '')
end

local function blocks_to_mermaid_source(blocks)
    local chunks = {}
    for _, blk in ipairs(blocks or {}) do
        if blk.t == 'Para' or blk.t == 'Plain' then
            chunks[#chunks + 1] = inlines_to_text_preserve_breaks(blk.content)
        elseif blk.t == 'CodeBlock' then
            chunks[#chunks + 1] = blk.text or ''
        else
            chunks[#chunks + 1] = pandoc.utils.stringify(blk)
        end
    end
    local s = table.concat(chunks, '\n')
    s = s:gsub('\n\n+', '\n')
    return s:gsub('^%s+', ''):gsub('%s+$', '')
end

local function first_nonempty_line(value)
    for line in tostring(value or ''):gmatch('[^\r\n]+') do
        local trimmed = line:gsub('^%s+', ''):gsub('%s+$', '')
        if trimmed ~= '' then
            return trimmed
        end
    end
    return ''
end

local function render_pdf(div)
    local body_text = blocks_to_plain_text(div.content)
    local path = first_nonempty_line(body_text)
    if path == '' then
        return pandoc.Blocks({})
    end
    return pandoc.RawBlock('html', '<div data-pdf="' .. escape_html_attribute(path) .. '"></div>')
end

local function render_video(div)
    local body_text = blocks_to_plain_text(div.content)
    local src = first_nonempty_line(body_text)
    if src == '' then
        return pandoc.Blocks({})
    end
    local cite = tostring((div.attributes or {}).cite or ''):gsub('^%s+', ''):gsub('%s+$', '')
    local html = '<video src="' .. escape_html_attribute(src) .. '">'
    if cite ~= '' then
        html = html .. '\n    <cite>' .. escape_html_text(cite) .. '</cite>'
    end
    html = html .. '\n</video>'
    return pandoc.RawBlock('html', html)
end

local function render_mermaid(div)
    local source = blocks_to_mermaid_source(div.content)
    if source == '' then
        return pandoc.Blocks({})
    end
    return pandoc.RawBlock('html', '<pre class="mermaid">\n' .. source .. '\n</pre>')
end

local function render_math(div)
    local formula = blocks_to_formula_text(div.content)
    if formula == '' then
        formula = blocks_to_markdown(div.content)
        formula = formula:gsub('`([^`]+)`%{=tex%}', '%1')
        formula = formula:gsub('`', '')
        formula = formula:gsub('%s+', ' ')
        formula = formula:gsub('^%s+', ''):gsub('%s+$', '')
    end
    if formula == '' then
        return pandoc.Blocks({})
    end
    local classes = 'math'
    if has_class(div.attr, 'macro') then
        classes = classes .. ' macro'
    end
    local html = '<div class="' .. classes .. '" data-formula="' .. escape_html_attribute(formula) .. '"></div>'
    return pandoc.RawBlock('html', html)
end

local function render_document(div)
    local inner = pandoc.write(pandoc.Pandoc(div.content), 'html')
    inner = inner:gsub('^%s+', ''):gsub('%s+$', '')
    return pandoc.RawBlock('html', '<div class="document">' .. '\n' .. inner .. '\n' .. '</div>')
end

local RICH_ALLOWED_TAGS = {
    p = true,
    ul = true,
    ol = true,
    li = true,
    blockquote = true,
    strong = true,
    em = true,
    h1 = true,
    a = true,
    i = true,
    u = true,
    code = true
}

local function warn_rich_unknown_tags(html)
    local seen = {}
    local lower = string.lower(html)
    for tag in lower:gmatch('</?([%a][%w-]*)') do
        if not RICH_ALLOWED_TAGS[tag] and not seen[tag] then
            seen[tag] = true
            io.stderr:write(
                '[JamsEDU] jams-rich: tag <'
                    .. tag
                    .. '> is outside the recommended subset '
                    .. '(p, ul, ol, li, blockquote, strong, em, h1, a, i, u, code).\n'
            )
        end
    end
end

local function render_rich(div)
    local placeholder = tostring((div.attributes or {}).placeholder or ''):gsub('^%s+', ''):gsub('%s+$', '')
    --- Quarto markdown often merges `{=html}` into RawBlock/HTML plus native Blocks; stringify like jams-document.
    local seed = pandoc.write(pandoc.Pandoc(div.content), 'html'):gsub('^%s+', ''):gsub('%s+$', '')
    warn_rich_unknown_tags(seed)
    local open = '<textarea class="rich"'
    if placeholder ~= '' then
        open = open .. ' placeholder="' .. escape_html_attribute(placeholder) .. '"'
    end
    open = open .. '>'
    --- Entity-escape the payload for the embedding document; browser decodes so `textarea.value` is HTML for TinyWYSIWYG.
    return pandoc.RawBlock('html', open .. escape_html_text(seed) .. '</textarea>')
end

local function Div(div)
    if has_class(div.attr, 'jams-pdf') then
        return render_pdf(div)
    end
    if has_class(div.attr, 'jams-video') then
        return render_video(div)
    end
    if has_class(div.attr, 'jams-mermaid') or has_class(div.attr, 'jams-diagram') then
        return render_mermaid(div)
    end
    if has_class(div.attr, 'jams-katex') or has_class(div.attr, 'jams-math') then
        return render_math(div)
    end
    if has_class(div.attr, 'jams-document') then
        return render_document(div)
    end
    if has_class(div.attr, 'jams-rich') then
        return render_rich(div)
    end
    return nil
end

return {
    { Div = Div }
}
