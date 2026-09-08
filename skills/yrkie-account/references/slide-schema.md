# skills-schema: DOE Slide Authoring for Local Agents

SlideEngine Schema v4.21 · wire version: 4 · skills edition: 1 (authoring contract 17) · 38 component types.

This is the complete Slide construction contract: document metadata, themes, canvas, backgrounds, layouts, components, and serialization. It defines field syntax and effects; design choices come from the user's brief or accompanying design instructions. Examples are structural references, not design prescriptions.

## 1. Reading and serialization rules

- TypeScript declarations describe JSON; do not output TypeScript. `?` means optional; other fields are required. `|` selects a type/value; `&` combines fields; `T[]` is an array; `[T,T,T]` requires exactly three entries. Bounds are inclusive. Declarations and additional constraints both apply.
- For a deck draft, output one complete `Root` JSON object; for a page edit, one complete `Slide`. MCP wrappers are defined in section 7. Use double-quoted keys/strings and unquoted numbers/booleans. No duplicate keys, comments, trailing commas, fences, placeholders, spread syntax, `undefined`, `null`, `NaN`, or `Infinity` inside Root/Slide. The transport-only null exception is declared in section 7. Field and enum spellings are case-sensitive.
- Escape strings once: quote `\"`, backslash `\\`, line break `\n`, tab `\t`. Unescaped line breaks inside strings are invalid; `\\n` produces visible backslash+n. Text is plain text; HTML/Markdown does not create rich text. Code and formula strings follow their own declared syntax.
- Objects are closed, including nested objects: only declared keys are allowed. Omit unused optional fields; do not fill empty strings/containers, guessed defaults, or `"auto"`. `Group.layout:{}` is valid. Never invent aliases or move fields between wrappers.
- Supplied strings must be nonblank, NUL-free, and at most 20,000 characters. IDs have at most 128 characters and no control characters; `deck.title` at most 200. Numbers are finite; indices and integer literals require integers. Zero and `false` are values, not omission.
- Slide IDs are unique across the deck; Node IDs are unique within each slide, including all nested Groups. Preserve the task's confirmed page count and order, within 1–200 slides. Each slide has at most 2,048 Nodes, counting Groups and Leaves; Groups may nest at most three levels, counting a root Group as level one.
- Copy task-supplied `src` references exactly, including scheme, case, and full suffix. Never invent URLs, hashes, paths, or generation markers. All sample assets, project references, revisions, and request IDs are fictional; never copy them into real calls.
- `Icon` is an available Lucide icon name in PascalCase, such as `Target`, `ShieldCheck`, or `Handshake`; not an image URL, SVG string, or component type. Optional icons may be omitted; a required icon still needs a valid name.

## 2. Document metadata, themes, canvas, and layout

Metadata has the exact paths below; there is no authorable `meta` wrapper.

| Path                               | Scope and effect                                             |
| ---------------------------------- | ------------------------------------------------------------ |
| `version`                          | Required wire version `4`, independent of this reference's edition. |
| `deck.title`                       | Document title; does not create visible slide text.          |
| `deck.theme`                       | Theme selection for the entire deck. Only `"yrkie-theme"` (Yrkie default) is available. |
| `pageNumber`                       | Root-level numbering settings for all slides, outside deck.  |
| `deck.slides`                      | Array order is presentation order; ID strings do not determine order. |
| `Slide.id`, `Node.id`              | Identity, not visible numbering. Preserve existing IDs when editing existing objects. |
| `Slide.size`                       | Required on every slide: exactly 960 × 540 pt, landscape 16:9. No alternative canvas or orientation value is supported. |
| `Slide.background`, `Slide.layout` | Affect that slide only; do not inherit to the next slide.    |
| `Group.layout`, `Leaf.layout`      | Affect that group or leaf; not document-level settings.      |

All slides/components inherit `deck.theme`; there are no per-slide/per-component theme overrides or custom theme objects. Theme owns colors, fonts, type scales, weights, and radii. Use declared semantic choices such as textRole, variant, foreground, and alignment; do not author CSS or raw style tokens. Editor state, speaker notes, animations, transitions, and export settings are outside this authoring JSON.

```ts
type Icon = string;
type Align = "left"|"center"|"right";
type CrossAlign = "start"|"center"|"end"|"stretch";
type Region = "content"|"media";
type Position = `${number}% ${number}%`;
type Three<T> = [T,T,T];
type Four<T> = [T,T,T,T];

type Root = {
  version:4;
  pageNumber:{ enabled:boolean;format:"number"|"fraction" };
  deck:{ title:string;theme:"yrkie-theme";slides:Slide[] };
};
type Slide = {
  id:string;
  size:{ width:960;height:540;unit:"pt" };
  blocks:Node[];// 1 or more
  background?:Background;
  layout?:{ preset:"flow"|"narrative"|"balanced"|"dashboard"|"edge-media" };
};
type Leaf = {
  [K in keyof Props]:{
    id:string;type:K;props:Props[K];layout?:{ span?:"full"|"half";region?:Region };
  }
}[keyof Props];
type Group = {
  id:string;type:"layout-group";
  layout:GroupLayout;
  children:Node[];// 1–24
};
type Node = Leaf|Group;
type GroupLayout = (
  { variant?:"row"|"stack" }|{ variant:"composition";direction:"row";ratio:"balanced"|"primary-first"|"primary-second" }|{ variant:"columns";columns:2|3|4 }
) & { align?:CrossAlign;region?:Region }|EdgeLayout;
type EdgeLayout = {
  variant:"edge-media";
  mediaPosition:"left"|"right"|"top"|"bottom";
  mediaRatio?:number;
  mediaShape?:"straight"|"fade"|"diagonal"|"circle"|"inner-circle";
  contentAlign?:"start"|"center"|"end";
};
type Background = {
  src:string;
  enabled?:boolean;
  fit?:"cover"|"contain";
  position?:Position;
  foreground?:"light"|"dark";
  overlay?:false|{ opacity?:number;direction?:"to-right"|"to-left"|"to-bottom"|"to-top" };
};
```

`Leaf.type` is a key of `Props`. Leaves have props; Groups have children; these are mutually exclusive. Catalog preset names are not types.

### Layout and background field effects

- Omitted Slide layout uses flow. Presets flow/balanced share baseline spacing; narrative increases section spacing; dashboard reduces page/group spacing; edge-media opens the specified media edge. Presets do not select a theme. Group `layout:{}` delegates arrangement; row/stack request horizontal/vertical child flow.
- `composition` requires exactly two direct children, `direction:"row"`, and a `ratio`. Ratios `balanced`, `primary-first`, and `primary-second` request 1:1, 3:2, and 2:3 respectively, with the first child on the left.
- `columns` requires numeric columns 2, 3, or 4. Each direct child is one column; multiple components in a column require a child Group. Extra children wrap. Other variants do not accept columns.
- Group `align` positions children on the cross axis, not their text. Leaf `span` requests full-row/half-row width; omission is automatic. Layout requests are space-dependent, not absolute coordinates.
- An `edge-media` slide requires BOTH `Slide.layout.preset:"edge-media"` and a single root Group with `layout:EdgeLayout`. The slide's `blocks` contains only that Group. It has exactly two direct children: one Node with `layout.region:"content"`, and one `media` Leaf with `layout.region:"media"`. `region` is permitted only on these two direct children. Child order does not select the image edge; `mediaPosition` does.
- Edge Groups cannot nest or coexist with `background`, even a disabled background. Only the media region reaches the page edge; content keeps its inset. `mediaRatio` is the image's page fraction: left/right accepts 0.28–0.52, default 0.36; top/bottom accepts 0.28–0.58, default 0.46. `contentAlign` controls vertical content alignment, default center.
- `mediaShape` defaults to straight: a straight boundary. Fade blends the media's inner edge into the page; diagonal clips it diagonally; circle makes an outward curved boundary; inner-circle cuts an inward curved boundary. Shapes follow mediaPosition and do not change the theme or source image.
- Background is a page layer behind blocks, not a media Leaf or a flow item. Omission removes it and uses the theme background. `enabled:false` hides it while retaining the source in authored JSON; omission/true enables it. The src remains required whenever background is supplied.
- `Background.fit` defaults to contain: contain preserves the complete image; cover preserves aspect ratio while cropping. `position` is exactly two space-separated percentages, horizontal then vertical, each 0–100; for example `"25% 80%"`. Its default is `"50% 50%"`. This position syntax also applies to `media`.
- `foreground:"light"`/`"dark"` selects light/dark foreground text, not a different theme; omission selects automatically. `overlay:false` disables the theme-colored overlay; an object accepts opacity 0–0.9, default 0. Direction runs from opaque toward transparent: to-right is left→right; to-left, to-bottom, to-top reverse or rotate this gradient. Default: to-right. `overlay:true` is invalid.
- `pageNumber.enabled:false` hides numbering; format remains required. Number displays current page; fraction displays current/total. Runtime derives current (one-based) and total from slide order/count; do not supply them or create a numbering Leaf.

## 3. Component props

Nesting is literal: `props.items` differs from `props.content.items`. Array comments specify data limits, not layout recommendations.

```ts
type TitleText = { title:string;text:string };
type ListProps = { items:string[];title?:string };// items 1–100
type CategoryAxis = { valuePrefix?:string;valueSuffix?:string;maxValue?:number;tickInterval?:number };
type TrendAxis = CategoryAxis & { includeZero?:boolean;minValue?:number };
type Series = { name:string;data:number[] };// data 1–100
type Categories = { categories:string[];series:Series[] };// each array: 1–100
type CategoryChart = { content:Categories & CategoryAxis;subtitle?:string;showLegend?:boolean };
type TableCell = string|number|{ text:string;emphasis?:"muted"|"highlight" };
type SemanticWrap = { locale?:string;protectedTerms?:string[] };
type DonutItem = {
  label:string;value:number;
  percentLabel?:string;badge?:string;primary?:boolean;
  valueLabel?:string|false;detailLabel?:string;
};
type WaterfallItem = {
  label:string;value:number;type?:"change"|"total";
  connectToNext?:boolean;showValue?:boolean;valuePosition?:"inside"|"above"|"badge";
};

type Props = {
  "hero":{ title:string;eyebrow?:string;subtitle?:string;icon?:Icon };
  "heading":{ text:string;level?:1|2|3;kicker?:string };
  "text":{ text:string;textRole?:"emphasis"|"title"|"content"|"describe" };
  "code-block":{
    code:string;wrap?:boolean;
    language?:"python"|"javascript"|"typescript"|"json"|"html"|"css"|"sql"|"shell"|"text";
  };
  "list":ListProps;
  "ordered-list":ListProps;
  "todo-list":{ items:{ text:string;checked:boolean }[];title?:string };// 1–100
  "notice":{ text:string;icon?:Icon };
  "stat":{ value:string|number;label?:string;description?:string };
  "media":{ src:string;alt:string;fit?:"natural"|"contain"|"cover"|"fill";position?:Position;aspectRatio?:"1:1"|"4:3"|"3:4"|"16:9"|"9:16" };
  "image-text":{ src:string;title:string;text:string;alt?:string };
  "icon-text":{ icon:Icon;title:string;text:string };
  "process-step":{ title:string;items:string[];duration:string };// items 1–4
  "math-formula":{ content:{ formula:string;display?:boolean;align?:Align } };

  "quote":{ text:string;source?:string };
  "question-card":{ title:string;text?:string;index?:string|number };
  "item-cards":{
    items:(TitleText & { icon?:Icon })[];// 1–12
    variant?:"filled"|"filled-icon"|"outline"|"side-rule"|"top-rule"|"top-icon"|"connected"|"connected-icon"|"leaf"|"quote"|"bubble";
  };
  "shape-contents":
    { variant?:"semicircle"|"petals";items:Three<TitleText> }|{ variant:"stairs"|"pyramid";items:TitleText[] };// stairs/pyramid: 2–12 items
  "capability-cards":{ content:{ items:(TitleText & { icon?:Icon })[] };title?:string };// 1–6
  "numbered-icon-cards":{ content:{ items:(TitleText & { icon:Icon })[] };title?:string };// 2–6

  "table":{
    content:{
      columns:({ header:string;align?:Align } & SemanticWrap)[];// 1–12
      rows:{ cells:TableCell[] }[];// 1–100
    };
    ariaLabel?:string;borderStyle?:"grid"|"none"|"three-line";
    semanticWrap?:false|SemanticWrap;
  };
  "grouped-bar-chart":CategoryChart;
  "line-chart":{
    content:TrendAxis & {
      categories:string[];// 1–100
      series:(Series & { labels?:{ index:number;text?:string|number }[] })[];// 1–100
    };
    showLegend?:boolean;smooth?:boolean;
  };
  "stacked-bar-chart":{
    content:Categories & CategoryAxis & {
      showYAxis?:boolean;showValues?:boolean;legendReversed?:boolean;
      annotation?:{ label:string;from?:number;to?:number };
    };
    subtitle?:string;showLegend?:boolean;
  };
  "radar-chart":{
    content:{
      axes:{ label:string;max:number }[];// 3–8
      datasets:{ name:string;values:number[] }[];// 1–3
    };
    subtitle?:string;showLegend?:boolean;
  };
  "donut-chart":{
    content:{
      items:DonutItem[];// 2–6
      variant?:"standard"|"compact"|"hero";showLegend?:boolean;
      center?:{ title?:string|string[];value?:string|number;eyebrow?:string;subtitle?:string|string[] };
      tag?:string;footerLines?:string[];
      footnotes?:{ align?:"left"|"right";text?:string;lines?:string[] }[];
      valuePrefix?:string;valueSuffix?:string;maximumFractionDigits?:0|1|2|3;
    };
  };
  "risk-matrix":{
    content:{
      items:{ label:string;x:number;y:number }[];// 1–100
      xLabel?:string;yLabel?:string;
      priorityZone?:{ x:number;y:number;width:number;height:number;label?:string;labelLines?:string[] };
    };
    subtitle?:string;
  };
  "waterfall-chart":{
    content:TrendAxis & {
      items:WaterfallItem[];// 2–100
      showYAxis?:boolean;showValues?:boolean;showChangeSigns?:boolean;staggerLabels?:boolean;
      footnote?:string;
      callouts?:{ index:number;text:string;position?:"above"|"below" }[];
      comparisons?:{ from:number;to:number;label:string }[];
    };
    subtitle?:string;
  };
  "stair-step-chart":{ title:string;subtitle:string;content:{ steps:Four<{ value:number;label:string }> } };

  "progress-list":{ content:{ items:{ title:string }[] } };// 1–12
  "circular-process-2":{ content:{ steps:[{ label:string },{ label:string }] } };
  "circular-process":{ content:{ steps:Three<{ label:string }> } };
  "circular-process-4":{ content:{ steps:Four<{ label:string }> } };
  "timeline-arrow":{ content:{ items:Four<{ year:string;description:string }> } };
  "triangle-metrics":{ content:{ centerLabel:string;items:Three<{ label:string;title:string;description:string }> } };
  "supply-chain-flow":{ content:{ stages:{ title:string;description?:string }[] };title?:string };// 2–6
  "chevron-list":{ content:{ items:{ label:string }[] } };// 2–6
  "fishbone-diagram":{ content:{ branches:{ side:"upper"|"lower";title:string;items:string[] }[];upperLabel?:string;lowerLabel?:string } };// branches 2–8, items per branch 1–3
};
```

### Text, media, and collections

- `heading.level` defaults to 2. `text.textRole` defaults to content; emphasis/title/content/describe select the theme's h2/h4/normal/small text roles. Heading and text have no authorable alignment field in this contract.
- Code language selects highlighting, default text; wrap defaults to true. False disables automatic wrapping. Code is always a string, including JSON code; escape its quotes/backslashes.
- `media.fit`: natural uses the intrinsic ratio; contain fits the complete image; cover crops without distortion; fill stretches. Omission lets the runtime infer fit. `aspectRatio` specifies the display frame's ratio; omission uses image metadata. `alt` is required and nonempty for media. `image-text` has a fixed image frame/fit, accepts optional `alt`, and does not accept media's fit/position/aspectRatio fields.
- `item-cards.variant` defaults to filled. Item icons are displayed only by filled-icon, top-icon, and connected-icon. Every variant uses the same `items` shape. `shape-contents.variant` defaults to semicircle; semicircle and petals require exactly three items, whereas stairs and pyramid allow 2–12. The catalog's card/shape presets are these types plus their variant; column presets are layout-groups with variant columns.
- List, process, and shape numbering is generated by the runtime, without an extra number field. `question-card.index` can supply the displayed marker; omission uses reading-order numbering. `numbered-icon-cards` has no authorable number/index field despite its type name.
- `process-step.duration` is required text, not a numeric time field. `todo-list.checked` is a required boolean for every item. `timeline-arrow.year` is a string, even when it contains only digits. `stat.value` accepts a number or a display string; quantitative chart values require numbers.

### Table

- `content.rows[*].cells.length === content.columns.length`; cell order follows columns. Rows are `{cells:[...]}`, not arrays. Cells accept strings, numbers, or `{text,emphasis?}`; object-cell text must be a string, even for numeric content.
- Column `align` controls cell text alignment. `borderStyle` defaults to grid; none and three-line select alternative border modes. `emphasis` selects muted or highlighted cell text.
- `semanticWrap:false` disables semantic wrapping. Locale is a language tag; protectedTerms keeps phrases together. Column locale overrides table locale; protectedTerms merge. AriaLabel is the accessibility label; semanticWrap true is invalid.

### Charts: data, indices, and display controls

- Grouped/line/stacked require `series[*].data.length === categories.length` for EVERY series, in category order. Grouped/stacked values are nonnegative; line/waterfall permit negatives. Chart data are numbers, not formatted strings such as `"12%"` or `"$30"`.
- Axis bounds require `minValue <= maxValue` when both exist; `tickInterval > 0`. `includeZero` controls zero inclusion. Prefix/suffix format labels without scaling or converting data.
- All indices are zero-based integers with `0 <= index < referenced array length`. Line `series[*].labels[*].index` and stacked `annotation.from/to` reference categories. Waterfall `callouts[*].index` and `comparisons[*].from/to` reference items. Recompute affected indices whenever arrays change.
- Grouped, line, stacked, and radar put `showLegend` directly in props, default true. Donut places it inside content. Line `smooth` defaults to true; false uses straight segments. Line `labels` attach annotations to the specified series points; omitted label text uses the point value. A line chart has no `subtitle` field.
- Stacked `showYAxis` defaults to false, `showValues` to true, and `legendReversed` to false. These control the axis, visible segment labels, and legend order; reversing the legend does not reorder series data. An annotation requires its label; omitted from/to use the first/last categories.
- Radar: each axis max > 0; every dataset's `values.length === axes.length`; each value is within 0 and its corresponding axis max.
- Donut values are nonnegative with at least one positive value. Percentages use value/sum; the sum need not be 100. `percentLabel` overrides percentage text without changing geometry; maximumFractionDigits is an integer 0–3.
- Donut variant defaults to standard; only standard renders a legend, even if another variant sets showLegend true. `primary` marks a primary item. A hero variant or an item's badge enables its badge/value/detail labels; `valueLabel:false` hides that value label, while a string overrides it. Do not use `true` or a number for valueLabel.
- Donut `center.value`, including numeric 0, selects the value/eyebrow/subtitle center branch; without value, center uses title. Title/subtitle may be a string or an array of lines. For footnotes, nonempty lines take precedence over text. `tag`, `footerLines`, and footnotes are display text, not slices or data series.
- Risk uses normalized coordinates 0–1: x increases rightward and y upward. All priorityZone x/y/width/height values also lie in 0–1, with `x+width <= 1` and `y+height <= 1`. Nonempty `labelLines` overrides label; width and height are spans, not opposite-corner coordinates.
- Waterfall item type defaults to change: its value adds to the running total, starting at zero. Type total uses an absolute value and resets the running total. Do not substitute a cumulative total for a change value. `connectToNext:false` hides that item's outgoing connector. `valuePosition` selects inside, above, or badge placement.
- Waterfall `showYAxis` and `showValues` default to true. A label is hidden if either global showValues or that item's showValue is false. `showChangeSigns` controls signed change labels, default false; `staggerLabels` controls alternating category-label rows. Callouts default to above; comparisons label the relationship between two indexed items. These annotations do not modify the running total.
- Stair-step: exactly four steps, percentage values 0–100 (`25` means 25%); title and subtitle are required.

## 4. Formula strings and escaping

`math-formula.props.content.formula` uses this LaTeX subset without `$`, `$$`, `\(`, `\)`, `\[`, or `\]` wrappers. Display defaults to false; true enables display-style limits where supported. Align defaults to center.

Supported structures (shown here before JSON escaping):

- Scripts: `x_{i}^{2}`. Use balanced braces for multi-character script expressions and command arguments.
- Fractions: `\frac{a}{b}`; dfrac/tfrac/cfrac have the same two-argument syntax. Roots: `\sqrt{x}`, `\sqrt[3]{x}`. Delimiters: paired `\left(a+b\right)`.
- Text/style commands with one braced text argument: text, mathrm, operatorname, mathit, mathbf, boldsymbol, mathsf, mathtt, mathbb, mathcal, mathfrak, textit, textbf, textrm, textup. No nested math-command expansion or full TeX font system.
- Prefix these operator/function names with a backslash: sum, prod, coprod, int, iint, iiint, oint, bigcup, bigcap, bigoplus, bigotimes, lim, liminf, limsup, max, min, sup, inf, log, ln, exp, sin, cos, tan, cot, sec, csc, arcsin, arccos, arctan, sinh, cosh, tanh, deg, ker, dim, det, arg, Pr, gcd. Limits use `_{lower}^{upper}`.
- Accent commands, each with one braced argument: hat, acute, dot, ddot, tilde, grave, breve, check, vec, bar, overline, overrightarrow, widehat, widetilde. Greek letters and mathematical symbols may be written directly as Unicode, such as `α`, `β`, `θ`, `≤`, `≥`, `×`, `∞`. Use Unicode or the listed structures for symbols not otherwise declared here; do not invent macros or external packages.
- Environments: matrix, pmatrix, bmatrix, vmatrix, Vmatrix, cases, aligned, align, alignedat, array. Match `\begin{NAME}` with `\end{NAME}`. Use `&` for columns and `\\` for rows. Matrix rows have equal column counts; cases uses two columns. Array accepts and ignores a column specification such as `{cc}`. Do not add a column-count argument after `\begin{alignedat}`.

Double every formula backslash in JSON; a TeX row break needs FOUR. Unescaped `\frac`/`\begin` silently become control escapes `\f`/`\b` despite valid JSON. Formulas must not contain those control characters. Independent Leaf examples:

```json
[
  {"id":"f1","type":"math-formula","props":{"content":{"formula":"\\frac{a_{1}+b}{2}","display":true,"align":"right"}}},
  {"id":"f2","type":"math-formula","props":{"content":{"formula":"\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}"}}},
  {"id":"f3","type":"math-formula","props":{"content":{"formula":"f(x)=\\begin{cases}x^{2}&x≥0\\\\-x&x<0\\end{cases}"}}},
  {"id":"f4","type":"math-formula","props":{"content":{"formula":"\\sum_{i=1}^{n}x_{i}+\\sqrt[3]{8}","display":true}}}
]
```

## 5. Complete Root examples

Document metadata, page background, columns, and text escaping:

```json
{"version":4,"pageNumber":{"enabled":true,"format":"fraction"},"deck":{"title":"Example","theme":"yrkie-theme","slides":[{"id":"s1","size":{"width":960,"height":540,"unit":"pt"},"background":{"src":"yrkie-asset-data://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","fit":"cover","foreground":"light","overlay":{"opacity":0.3,"direction":"to-right"}},"blocks":[{"id":"h1","type":"heading","props":{"text":"Example heading"}},{"id":"g1","type":"layout-group","layout":{"variant":"columns","columns":2},"children":[{"id":"t1","type":"text","props":{"text":"She said \"yes\".\nThe next line."}},{"id":"st1","type":"stat","props":{"value":42,"label":"Count"}}]}]}]}}
```

Edge media with both required declarations and direct-child regions:

```json
{"version":4,"pageNumber":{"enabled":false,"format":"number"},"deck":{"title":"Edge example","theme":"yrkie-theme","slides":[{"id":"s1","size":{"width":960,"height":540,"unit":"pt"},"layout":{"preset":"edge-media"},"blocks":[{"id":"edge","type":"layout-group","layout":{"variant":"edge-media","mediaPosition":"right","mediaRatio":0.4,"mediaShape":"fade","contentAlign":"center"},"children":[{"id":"copy","type":"layout-group","layout":{"variant":"stack","region":"content"},"children":[{"id":"h1","type":"heading","props":{"text":"Example heading"}},{"id":"t1","type":"text","props":{"text":"Example body"}}]},{"id":"image","type":"media","layout":{"region":"media"},"props":{"src":"yrkie-asset-data://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","alt":"Example image"}}]}]}]}}
```

## 6. Exact Leaf shapes: all 38 types

These are independent Leaves, not a Root or a page composition. Place a Leaf in Slide.blocks or Group.children with a unique per-slide ID. Optional fields remain available as declared.

```json
[
  {"id":"n1","type":"hero","props":{"title":"Title"}},
  {"id":"n2","type":"heading","props":{"text":"Heading","level":1}},
  {"id":"n3","type":"text","props":{"text":"Body","textRole":"describe"}},
  {"id":"n4","type":"code-block","props":{"code":"{\"ok\":true}","language":"json"}},
  {"id":"n5","type":"list","props":{"items":["One","Two"]}},
  {"id":"n6","type":"ordered-list","props":{"items":["One","Two"]}},
  {"id":"n7","type":"todo-list","props":{"items":[{"text":"Task","checked":false}]}},
  {"id":"n8","type":"notice","props":{"text":"Note"}},
  {"id":"n9","type":"stat","props":{"value":42,"label":"Count"}},
  {"id":"n10","type":"media","props":{"src":"yrkie-asset-data://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","alt":"Example image"}},
  {"id":"n11","type":"image-text","props":{"src":"yrkie-asset-data://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","title":"Title","text":"Body"}},
  {"id":"n12","type":"icon-text","props":{"icon":"Target","title":"Title","text":"Body"}},
  {"id":"n13","type":"process-step","props":{"title":"Stage","items":["Action"],"duration":"2 weeks"}},
  {"id":"n14","type":"math-formula","props":{"content":{"formula":"x_{i}^{2}"}}},
  {"id":"n15","type":"quote","props":{"text":"Quotation","source":"Source"}},
  {"id":"n16","type":"question-card","props":{"title":"Question","text":"Answer"}},
  {"id":"n17","type":"item-cards","props":{"variant":"filled-icon","items":[{"title":"Title","text":"Body","icon":"Target"}]}},
  {"id":"n18","type":"shape-contents","props":{"items":[{"title":"A","text":"Body"},{"title":"B","text":"Body"},{"title":"C","text":"Body"}]}},
  {"id":"n19","type":"capability-cards","props":{"content":{"items":[{"title":"Title","text":"Body"}]}}},
  {"id":"n20","type":"numbered-icon-cards","props":{"content":{"items":[{"title":"A","text":"Body","icon":"Target"},{"title":"B","text":"Body","icon":"ShieldCheck"}]}}},
  {"id":"n21","type":"table","props":{"content":{"columns":[{"header":"Name"},{"header":"Value","align":"right"}],"rows":[{"cells":["A",12]},{"cells":["B",{"text":"20","emphasis":"highlight"}]}]},"borderStyle":"three-line"}},
  {"id":"n22","type":"grouped-bar-chart","props":{"content":{"categories":["A","B"],"series":[{"name":"Series","data":[10,20]}]}}},
  {"id":"n23","type":"line-chart","props":{"content":{"categories":["A","B"],"series":[{"name":"Series","data":[-5,20],"labels":[{"index":1,"text":"Peak"}]}]},"smooth":false}},
  {"id":"n24","type":"stacked-bar-chart","props":{"content":{"categories":["A","B"],"series":[{"name":"First","data":[10,20]},{"name":"Second","data":[5,8]}],"annotation":{"label":"Change","from":0,"to":1}}}},
  {"id":"n25","type":"radar-chart","props":{"content":{"axes":[{"label":"A","max":10},{"label":"B","max":10},{"label":"C","max":10}],"datasets":[{"name":"Series","values":[5,7,9]}]}}},
  {"id":"n26","type":"donut-chart","props":{"content":{"items":[{"label":"A","value":25},{"label":"B","value":75}],"center":{"value":100,"eyebrow":"Total"}}}},
  {"id":"n27","type":"risk-matrix","props":{"content":{"items":[{"label":"A","x":0.6,"y":0.7}],"priorityZone":{"x":0.5,"y":0.5,"width":0.5,"height":0.5}}}},
  {"id":"n28","type":"waterfall-chart","props":{"content":{"items":[{"label":"Start","value":100,"type":"total"},{"label":"Change","value":-20},{"label":"End","value":80,"type":"total"}],"callouts":[{"index":1,"text":"Decrease"}],"comparisons":[{"from":0,"to":2,"label":"Net change"}]}}},
  {"id":"n29","type":"stair-step-chart","props":{"title":"Steps","subtitle":"Percent","content":{"steps":[{"value":25,"label":"1"},{"value":50,"label":"2"},{"value":75,"label":"3"},{"value":100,"label":"4"}]}}},
  {"id":"n30","type":"progress-list","props":{"content":{"items":[{"title":"First"}]}}},
  {"id":"n31","type":"circular-process-2","props":{"content":{"steps":[{"label":"A"},{"label":"B"}]}}},
  {"id":"n32","type":"circular-process","props":{"content":{"steps":[{"label":"A"},{"label":"B"},{"label":"C"}]}}},
  {"id":"n33","type":"circular-process-4","props":{"content":{"steps":[{"label":"A"},{"label":"B"},{"label":"C"},{"label":"D"}]}}},
  {"id":"n34","type":"timeline-arrow","props":{"content":{"items":[{"year":"2026","description":"Milestone"},{"year":"2027","description":"Milestone"},{"year":"2028","description":"Milestone"},{"year":"2029","description":"Milestone"}]}}},
  {"id":"n35","type":"triangle-metrics","props":{"content":{"centerLabel":"Center","items":[{"label":"A","title":"Title","description":"Detail"},{"label":"B","title":"Title","description":"Detail"},{"label":"C","title":"Title","description":"Detail"}]}}},
  {"id":"n36","type":"supply-chain-flow","props":{"content":{"stages":[{"title":"A"},{"title":"B","description":"Detail"}]}}},
  {"id":"n37","type":"chevron-list","props":{"content":{"items":[{"label":"A"},{"label":"B"}]}}},
  {"id":"n38","type":"fishbone-diagram","props":{"content":{"branches":[{"side":"upper","title":"A","items":["Cause"]},{"side":"lower","title":"B","items":["Cause"]}]}}}
]
```


## 7. Local-agent submission contract

Sections 1–6 define documents; external writes also require the following rules. Use your own model for drafts and installed Yrkie MCP tools for platform operations, following the Skill workflow. Never reconstruct HTTP requests. Valid JSON is not approval or proof of saving.

### 7.1 External text and size constraints

- Both character limits above AND byte limits apply: every string is at most 65,536 UTF-8 bytes; each serialized Slide at most 2,000,000 bytes; complete create request at most 8,388,608 bytes; edit/delete request body at most 2,008,192 bytes. Count escaped JSON and wrappers in request size. Maximum JSON nesting is 32 (separate from three Group levels); the document value budget is 250,000, including containers and scalars.
- Strings allow LF and tab, but no other control characters, carriage returns, or bidi controls U+202A–U+202E/U+2066–U+2069. Normalize actual CRLF line endings to LF before JSON encoding. Never remove required visible content merely to satisfy a limit.
- The external writer scans decoded strings, including code and formulas. It rejects tag-like markup and case-insensitive occurrences of `javascript:`, `vbscript:`, `file:`, `data:`, `url(`, or `expression(`, including whitespace before the colon/parenthesis. Substring matches also count. JSON Unicode escapes do not bypass this check. The declared Icon contract uses Lucide names, not SVG.
- Thus `language:"html"` or `"css"` does not exempt code from external checks. A formula comparison can use `a < b`; adjacent `<b` at a string end resembles a tag. If exact requested content cannot pass, explain the unsupported content instead of changing its meaning or claiming it was saved.

### 7.2 Assets and page count

Before saving, the project must have a confirmed outline and `yrkie_outline_image_status` must return `ready:true`. Use its final `outlineVersion`, `revision`, `eligiblePages`, and `assets`. Creating/replacing a deck requires exactly eligiblePages slides in eligible outline order, even after pages were deleted from an earlier deck. Do not substitute total outline pages, subscription guesses, or current deck length.

Every src must be an exact `assets[*].slideReference` from that project's confirmed eligible outline. Canonical syntax is `yrkie-asset-data://` followed by 64 lowercase hexadecimal characters. Syntax alone does not prove ownership or availability. No URLs, data URLs, base64, local paths, unbound uploads, or generation markers are accepted. Do not copy manifest metadata into component props.

| Image location                     | Required manifest imageType and ratio                        |
| ---------------------------------- | ------------------------------------------------------------ |
| Ordinary media/image-text          | A matching authorized source; ordinary placement accepts content or decorative assets. |
| Slide background, even if disabled | decorative; 4:3 or 16:9.                                     |
| Left/right edge media              | decorative; 3:4, 4:5, or 9:16.                               |
| Top/bottom edge media              | decorative; 4:3 or 16:9.                                     |

These are source-metadata constraints. Setting `media.props.aspectRatio` does not change a manifest ratio; notably 4:5 is accepted source metadata but is not an authorable aspectRatio enum. Content images cannot become backgrounds/edge images by changing fit. Obtain missing assets through the approved outline/image workflow, not an invented reference.

### 7.3 MCP argument shapes

The tool argument `deck` below contains the ENTIRE Root, including its own deck. Consequently `args.deck.deck.slides` is correct. `args.slide` contains only the target Slide. Pass objects, never JSON strings, arrays, JSON Patch, or partial updates. Transport fields do not belong inside Root, Slide, or props. Tool names may have a client-specific prefix.

```ts
type ProjectRef = string;// copy returned prj_ reference; 64 lowercase hex characters after prj_
type RequestId = string;// new lowercase UUID per distinct operation
type Revision = number;// integer 1–9007199254740991, copied from a read
type CreateSlidesArgs = {
  projectRef:ProjectRef;requestId:RequestId;
  expectedRevision:Revision|null;
  expectedOutline:{version:Revision;revision:Revision};
  deck:Root;acknowledgeReplace:true;
};
type EditSlideArgs = {
  projectRef:ProjectRef;requestId:RequestId;
  pageNumber:number;// one-based current page position
  expectedRevision:Revision;slide:Slide;
};
type DeleteSlideArgs = {
  projectRef:ProjectRef;requestId:RequestId;
  pageNumber:number;// one-based current page position
  expectedRevision:Revision;acknowledgeDelete:true;
};
```

- `yrkie_create_slides`: copy project_info.currentDeck.revision; expectedRevision is null only if currentDeck explicitly equals null. Missing/deleted state is not absence. Copy expectedOutline.version/revision from final image-status outlineVersion/revision. This atomically replaces ALL pages; acknowledgeReplace requires approval of that exact replacement.
- `yrkie_edit_slide`: first read `yrkie_project_slide` with includeSchema true. Preserve returned slide.id and use that response's deck revision. Submit the complete reviewed Slide at the current one-based pageNumber. This cannot change deck title/theme/page numbering or unrelated pages. ExpectedOutline is not an edit argument.
- `yrkie_delete_slide`: use a fresh target read's position and revision, with approval for that exact deletion. At least one page must remain. Do not generate a Root/Slide payload for this tool.
- Content-array indices are zero-based; tool pageNumber is one-based; Root.pageNumber is an object. These three meanings are not interchangeable. Revisions are concurrency tokens, not page numbers. Generate a UUID with a UUID generator; reuse it only for identical uncertain retries, including identical payload and expected revisions.
- ProjectRef is temporary. After expiry or reconnecting, obtain a fresh reference to the SAME project. An identical retry retains its UUID, body, page position, and expected revisions; a refreshed reference does not authorize a different project or account.

Minimal create arguments (fictional one-page, already-confirmed project with no existing deck):

```json
{"projectRef":"prj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","requestId":"11111111-1111-4111-8111-111111111111","expectedRevision":null,"expectedOutline":{"version":1,"revision":2},"acknowledgeReplace":true,"deck":{"version":4,"pageNumber":{"enabled":true,"format":"number"},"deck":{"title":"Example","theme":"yrkie-theme","slides":[{"id":"s1","size":{"width":960,"height":540,"unit":"pt"},"blocks":[{"id":"t1","type":"text","props":{"text":"Example body"}}]}]}}}
```

Minimal edit arguments (fictional read returned page 1, slide ID s1, deck revision 3):

```json
{"projectRef":"prj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","requestId":"22222222-2222-4222-8222-222222222222","pageNumber":1,"expectedRevision":3,"slide":{"id":"s1","size":{"width":960,"height":540,"unit":"pt"},"blocks":[{"id":"t1","type":"text","props":{"text":"Updated body"}}]}}
```

### 7.4 Validation and result handling

Strictly parse JSON, rejecting duplicate keys, then check every declared constraint. TypeScript cannot check cross-field relations or project state. No validation-only MCP tool exists: writes mutate content. Follow Skill approval rules for the concrete write; identical retries retain prior approval.

The external writer performs no automatic repair and saves no partial deck on validation failure. Read each issue's path, code, message, and hint. For creation, `/deck/deck/slides/0` means the first slide inside the tool's complete Root; edit page issues use `/slide`. Correct an identified defect, revalidate, and treat changed input as a new operation with a new UUID.

- `slide_revision_conflict`: reread the affected state and review the revised change; never insert a newer revision into an old draft to force overwrite.
- `outline_conflict`/`outline_images_not_ready`: reread final image status and wait for readiness; do not alter the locked outline or start a paid retry implicitly.
- `asset_unavailable`/image-placement issues: reconcile exact manifest references and source metadata; changing fit does not repair authorization.
- `slide_schema_unavailable`: an existing page cannot be returned under the current contract; resolve it in the application rather than inventing a page from its Markdown.
- Uncertain response: retry the identical UUID/input. `idempotency_conflict` means the operation identity was reused with different input. `replayed:true` is the prior operation's receipt, not necessarily the current deck revision.

Only a matching success receipt establishes saved/edited/deleted status, not visual fit or export. Draft output is only Root/Slide JSON; authorized tool calls use their argument object. Draft-only output rules do not constrain approval discussions or error reports.