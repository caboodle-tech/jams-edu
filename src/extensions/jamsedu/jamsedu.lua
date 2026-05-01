--- JamsEDU Quarto shortcodes (video, PDF embed, Mermaid).
--- Fenced `::: {.jams-*}` blocks are preferred for Quarto authoring; shortcodes remain supported for one-line use.

local function jams_video(args)
    local src = pandoc.utils.stringify(args[1] or "")
    local cite = pandoc.utils.stringify(args[2] or "")
    local html = '<video src="' .. src .. '">'
    if cite ~= "" then
        html = html .. "\n    <cite>" .. cite .. "</cite>"
    end
    html = html .. "\n</video>"
    return pandoc.RawBlock('html', html)
end

local function jams_pdf(args)
    local path = pandoc.utils.stringify(args[1] or "")
    local html = '<div data-pdf="' .. path .. '"></div>'
    return pandoc.RawBlock('html', html)
end

local function escape_html_text(value)
    return tostring(value or "")
        :gsub("&", "&amp;")
        :gsub("<", "&lt;")
        :gsub(">", "&gt;")
end

local function math_inline_source(args, kwargs, raw_args)
    local fromKwarg = pandoc.utils.stringify((kwargs or {}).formula or "")
    if fromKwarg ~= "" then
        return fromKwarg
    end
    if args ~= nil and #args > 0 then
        local fromArg = pandoc.utils.stringify(args[1])
        if fromArg ~= "" then
            return fromArg
        end
    end
    if type(raw_args) == "table" then
        local parts = {}
        for _, v in ipairs(raw_args) do
            local piece = pandoc.utils.stringify(v)
            if piece ~= "" then
                table.insert(parts, piece)
            end
        end
        return table.concat(parts, " ")
    end
    return ""
end

local function jams_math_inline(args, kwargs, meta, raw_args, context)
    local formula = math_inline_source(args, kwargs, raw_args)
    if formula == "" then
        return pandoc.Inlines({})
    end
    local classes = "math inline"
    local macroFlag = pandoc.utils.stringify((kwargs or {}).macro or "")
    if macroFlag == "true" or macroFlag == "1" then
        classes = classes .. " macro"
    end
    local html = '<span class="' .. classes .. '">' .. escape_html_text(formula) .. "</span>"
    if context == "block" then
        return pandoc.RawBlock("html", html)
    end
    return pandoc.RawInline("html", html)
end

--- @param args pandoc.List First positional arg is the diagram source when quoted in the shortcode.
--- @param _kwargs table
--- @param _meta table
--- @param raw_args string[]|table Tokenized shortcode arguments as plain strings.
--- @param context "block"|"inline"|"text"|nil
local function diagramSource(args, raw_args)
    if args ~= nil and #args > 0 then
        local fromArg = pandoc.utils.stringify(args[1])
        if fromArg ~= "" then
            return fromArg
        end
    end
    if type(raw_args) == "table" then
        local parts = {}
        for _, v in ipairs(raw_args) do
            local piece = pandoc.utils.stringify(v)
            if piece ~= "" then
                table.insert(parts, piece)
            end
        end
        return table.concat(parts, " ")
    end
    return ""
end

--- @param args pandoc.List
--- @param kwargs table
--- @param meta table
--- @param raw_args string[]|table
--- @param context "block"|"inline"|"text"|nil
local function jams_mermaid(args, kwargs, meta, raw_args, context)
    local content = diagramSource(args, raw_args)
    if content == "" then
        if context == "inline" then
            return pandoc.Inlines({})
        end
        return pandoc.Blocks({})
    end
    local html = '<pre class="mermaid">\n' .. content .. '\n</pre>'
    if context == "inline" or context == "text" then
        return pandoc.RawInline('html', html)
    end
    return pandoc.RawBlock('html', html)
end

return {
    ['jams-video'] = jams_video,
    ['jams-pdf'] = jams_pdf,
    ['jams-mermaid'] = jams_mermaid,
    ['jams-diagram'] = jams_mermaid,
    ['jams-math-inline'] = jams_math_inline,
    ['jams-katex-inline'] = jams_math_inline
}
