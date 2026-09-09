# skills-schema: DOE Slide Authoring for Local Agents

SlideEngine Schema v4.21 · wire version: 4 · skills edition: 2 (authoring contract 18) · 39 component types.

## 1. Reading and serialization rules

- TypeScript describes JSON: `?` optional, otherwise required; `|` alternatives; `&` combined fields; `T[]` array; `[T,T,T]` exactly three items. Bounds are inclusive; prose constraints also apply.
- For a deck draft, output one complete `Root` JSON object; for a page edit, one complete `Slide`. MCP wrappers are defined in section 7. Use double-quoted keys/strings and unquoted numbers/booleans. No duplicate keys, comments, trailing commas, fences, placeholders, spread syntax, `undefined`, `null`, `NaN`, or `Infinity` inside Root/Slide. The transport-only null exception is declared in section 7. Field and enum spellings are case-sensitive.
- Escape strings once: quote `\"`, backslash `\\`, newline `\n`, tab `\t`; raw newlines in strings are invalid, `\\n` is literal backslash+n. Text is plain; HTML/Markdown adds no formatting. Code/formulas use their declared syntax.
- Containers are real objects/arrays, including tool arguments: `"props":{"text":"Hi"}`, never stringified JSON. Escape only string fields.
- Objects are closed, including nested ones. Use only declared keys/values; omit unused optional fields. Empty containers/strings or auto are allowed only where explicitly declared; `Group.layout:{}` is valid. Never guess aliases/defaults.
- Supplied strings must be nonblank, NUL-free, and at most 20,000 characters. IDs have at most 128 characters and no control characters; `deck.title` at most 200. Numbers are finite; indices and integer literals require integers. Zero and `false` are values, not omission.
- Slide IDs are unique across the deck; Node IDs are unique within each slide, including all nested Groups. Preserve the task's confirmed page count and order, within 1–200 slides. Each slide has at most 2,048 Nodes, counting Groups and Leaves; Groups may nest at most three levels, counting a root Group as level one.
- Copy task-supplied `src` references exactly, including scheme, case, and full suffix. Never invent URLs, hashes, paths, or generation markers. All sample assets, project references, revisions, and request IDs are fictional; never copy them into real calls.
- `Icon` is an available Lucide icon name in PascalCase, such as `Target`, `ShieldCheck`, or `Handshake`; not an image URL, SVG string, or component type. Optional icons may be omitted; a required icon still needs a valid name.

## 2. Document metadata, themes, canvas, and layout

No `meta` wrapper.

| Path | Scope and effect |
| --- | --- |
| `version` | Required wire value 4; separate from reference edition. |
| `deck.title` | Document title, not visible text. |
| `deck.theme` | Deck theme: only `"yrkie-theme"` (Yrkie default). |
| `pageNumber` | Deck-wide numbering, outside deck. |
| `deck.slides` | Presentation order follows array order, not IDs. |
| `Slide.id`, `Node.id` | Identity; preserve existing IDs when editing. |
| `Slide.size` | Required: 960×540 pt, landscape 16:9 only. |
| `Slide.background`, `Slide.layout` | Apply to this slide only. |
| `Group.layout`, `Leaf.layout` | Apply to this node only. |

Theme owns colors/fonts/scales/weights/radii; no local/custom themes or CSS/style tokens. Editor state, notes, animation, transitions and export settings are not authorable.

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

Leaf.type must match Props. Leaves have props; Groups have children, never both. Presets are not types.

### Layout and background field effects

- Slide preset defaults to flow; flow/balanced use baseline spacing, narrative increases section gaps, dashboard reduces padding/gaps. Edge-media opens the media edge. Group layout:{} delegates arrangement; row/stack request horizontal/vertical flow.
- `composition`: exactly two direct children, `direction:"row"`, required ratio: balanced=1:1, primary-first=3:2, primary-second=2:3. First child is left.
- `notice` cannot be a direct or nested descendant of `composition`; a stack wrapper does not help. Move it outside every composition ancestor, or change composition to row/stack/columns and remove direction/ratio. Other compatible nested Groups remain valid.
- `columns`: numeric 2|3|4, accepted only by this variant. Each direct child occupies a column; wrap multiple components in a child Group. Extra children wrap.
- Group `align` controls cross-axis position, not text alignment. Leaf span full/half requests row width; omission is automatic. These are layout requests, not coordinates.
- `edge-media` requires BOTH `Slide.layout.preset:"edge-media"` and exactly one root Group with `layout:EdgeLayout`. Its two children are one content Node (`layout.region:"content"`) and one media Leaf (`layout.region:"media"`). Only these children accept region. `mediaPosition`, not child order, selects the edge.
- Edge Groups cannot nest or coexist with background, even disabled. Only media bleeds; content retains padding. `mediaRatio` is the image fraction: left/right 0.28–0.52 (default 0.36), top/bottom 0.28–0.58 (default 0.46). `contentAlign` positions content vertically, default center.
- `mediaShape`: straight=straight edge (default); fade=inward blend; diagonal=diagonal clip; circle=outward curve; inner-circle=inward cut. Follows mediaPosition without changing theme/source.
- Background sits behind blocks, outside flow. Omit it for theme background. `enabled:false` hides but retains it; omission/true enables it. Every supplied background requires src.
- Background fit: contain=complete image (default); cover=proportional crop. Background/media position: two percentages 0–100, horizontal then vertical; default `"50% 50%"`, e.g. `"25% 80%"`.
- `foreground` light/dark selects text; omission is automatic. `overlay:false` disables it; object opacity=0–0.9 (default 0). Direction is opaque-to-transparent, default to-right; to-left/to-bottom/to-top reverse/rotate it. `overlay:true` is invalid.
- `pageNumber.enabled:false` hides numbering; format remains required. `number`=current, `fraction`=current/total. Runtime derives both from page order/count; do not author values or numbering Leaves.


### Layout execution boundaries

- Edge media consumes its fraction BEFORE content padding: a 0.35 side image leaves 65% of page width before insets. All visible text/components must fit the remaining region; only designated media bleeds.
- contentAlign positions content; it does not shrink it. Image fit/masks, presets, span and legal item counts do not establish capacity. Columns may reflow vertically; count the resulting stack, nested images and labels in the height budget.
- Preserve required text/data and confirmed page count/order. Recompose with declared layouts; never clip/hide content, invent coordinates/font controls/overflow bypasses, or assume continuation pages appear automatically.
- Check EVERY final page/region. With a renderer, fits:false, safe-area-overflow, locked-bleed-overflow, overlaps, blocked wrapping or component-fit failures require correction/recheck. Schema-valid does not mean visually safe. Without rendering, do not claim measured fit or rely on automatic shrinkage.

## 3. Component props

Field paths are literal for EVERY Leaf, including nested children. Required content is an object, never an array/string; do not infer or flatten wrappers.

| Exact array path | Component types |
| --- | --- |
| `props.items` | list, ordered-list, todo-list, contents, item-cards, shape-contents, process-step |
| `props.content.items` | progress-list, capability-cards, numbered-icon-cards, donut-chart, risk-matrix, waterfall-chart, timeline-arrow, triangle-metrics, chevron-list |
| `props.content.steps` | circular-process-2, circular-process, circular-process-4, stair-step-chart |
| `props.content.stages` | supply-chain-flow |
| `props.content.branches` | fishbone-diagram |
| `props.content.columns`, `props.content.rows` | table; each row owns `cells` |
| `props.content.categories`, `props.content.series` | grouped-bar-chart, line-chart, stacked-bar-chart |
| `props.content.axes`, `props.content.datasets` | radar-chart |

Supply-chain-flow props: `{"content":{"stages":[{"title":"A"},{"title":"B"}]}}`. Invalid: `props.stages`, `props.content:[...]`, `props.content.items`. Direct props.items collections have no content wrapper. Type changes require matching props/item fields. Wrong-path data is missing data; array bounds do not guarantee fit.

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
"contents":{
  presentation:"cards:filled"|"cards:filled-icon"|"cards:outline"|"cards:side-rule"|"cards:top-rule"|"cards:top-icon"|"cards:connected"|"cards:connected-icon"|"cards:leaf"|"cards:quote"|"cards:bubble"|"icon-text"|"list:unordered"|"list:ordered"|"shape:semicircle"|"shape:petals"|"shape:stairs"|"shape:pyramid"|"capability"|"numbered"|"question"|"quotation"|"columns";
  items:{id:string;title?:string;text?:string;icon?:Icon;source?:string;label?:string|number;bullets?:string[]}[];
  title?:string;subtitle?:string;itemLayout?:"auto"|"stack"|"grid";itemColumns?:"auto"|1|2|3|4;columnPreference?:"auto"|1|2|3|4;
};
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

- Heading level defaults to 2. Text role defaults to content; emphasis/title/content/describe map to theme h2/h4/normal/small. Heading/text have no authorable alignment field.
- Code language selects highlighting (default text); wrap defaults true. Code, including JSON, is an escaped string.
- Media fit: natural=intrinsic ratio, contain=complete image, cover=proportional crop, fill=stretch; omission infers fit. AspectRatio sets the display frame; omission uses metadata. Media requires nonempty alt. Image-text has fixed frame/fit, optional alt, and no fit/position/aspectRatio fields.
- Contents: preserve unique item IDs and hidden icons on replacement; empty optional slots are hidden. Counts: semicircle/petals=3, stairs/pyramid=2–12, numbered=2–6, others=1–12. Required fields: shapes=title/text; numbered=title/text/icon; capability=title/icon plus text or bullets; question=title; quotation=text without title. Source is quotation-only, label question-only, bullets capability-only. Nonempty component title is allowed only for capability/numbered/cards/list:unordered/list:ordered; no nonempty subtitle. Item-column caps: 3 by default, columns=4, list:unordered/list:ordered=2, shapes=1. `columnPreference` preserves a previous 1–4-column choice. Never discard fields to force a style.
- Item-cards defaults to filled; only filled-icon/top-icon/connected-icon display icons. All variants share items. Shape-contents defaults to semicircle; semicircle/petals require 3 items; stairs/pyramid allow 2–12. Card/shape presets combine type+variant; column presets are layout-groups.
- Runtime numbers lists/processes/shapes. Question-card index overrides its reading-order marker. Numbered-icon-cards accepts no number/index field.

- `process-step.items` belongs to ONE step, not one component per item. Its title, duration and 1–4 item strings share the step region. Include wrapped text height in the parent budget; item count alone does not certify fit. Preserve all strings when recomposing.

### Table

- `content.rows[*].cells.length === content.columns.length`, in column order. Rows are `{cells:[...]}`, never bare arrays. Cells accept strings/numbers or `{text,emphasis?}`; object text must be a string.
- Column align controls cell text. BorderStyle defaults to grid; none/three-line select border modes. Emphasis selects muted/highlighted text.
- `semanticWrap:false` disables wrapping; true is invalid. Locale is a language tag; protectedTerms keeps phrases together. Column locale overrides table locale; protectedTerms merge. `ariaLabel` supplies accessibility text.

### Charts: data, indices, and display controls

- Grouped/line/stacked: EVERY `series[*].data.length === categories.length`, in category order. Grouped/stacked values are nonnegative; line/waterfall allow negatives. Data must be numbers, never `"12%"`/`"$30"`.
- Axis: `minValue <= maxValue` when both exist; `tickInterval > 0`; includeZero controls zero inclusion. Prefix/suffix format labels without changing data.
- Indices are zero-based integers within the referenced array. Line labels.index and stacked annotation.from/to reference categories; waterfall callouts.index and comparisons.from/to reference items. Recompute indices after array changes.
- Grouped/line/stacked/radar showLegend is in props (default true); donut showLegend is in content. Line smooth defaults true; false uses straight segments. Line labels annotate series points; omitted text uses point values. Line has no subtitle.
- Stacked defaults: showYAxis=false, showValues=true, legendReversed=false. Legend reversal leaves series/data order unchanged. Annotation requires label; omitted from/to select first/last categories.
- Radar: each axis max > 0; dataset values.length equals axes.length; each value is 0–its axis max.
- Donut: nonnegative values, at least one positive. Percentages=value/sum; sum need not be 100. PercentLabel overrides text, not geometry. MaximumFractionDigits is integer 0–3.
- Donut defaults to standard; only standard renders a legend. Primary marks an item. Hero variant or item badge enables badge/value/detail labels. ValueLabel accepts false (hide) or string (override), never true/number.
- Donut center.value (including 0) selects value/eyebrow/subtitle; otherwise center uses title. Title/subtitle accept strings or line arrays. Footnote lines override text. Tag/footerLines/footnotes are display text, not data.
- Risk: normalized x/y 0–1, increasing right/up. PriorityZone x/y/width/height are 0–1 with x+width<=1 and y+height<=1; width/height are spans. Nonempty labelLines overrides label.
- Waterfall type defaults to change: add value to running total, initially zero. Total sets an absolute total. Do not substitute cumulative totals for changes. ConnectToNext false hides the outgoing connector; valuePosition selects inside/above/badge.
- Waterfall defaults: showYAxis/showValues=true, showChangeSigns/staggerLabels=false. Global or item showValues/showValue false hides labels. StaggerLabels alternates category-label rows. Callouts default above; comparisons label indexed relationships. Neither changes totals.
- Stair-step requires 4 steps, values 0–100 (25 means 25%), title and subtitle.

## 4. Formula strings and escaping

`math-formula.props.content.formula` uses this LaTeX subset without `$`, `$$`, `\(`, `\)`, `\[`, or `\]` wrappers. Display defaults to false; true enables display-style limits where supported. Align defaults to center.

Before JSON escaping:

- Scripts: `x_{i}^{2}`. Balance braces around multi-character expressions and command arguments.
- Fractions: `\frac{a}{b}`; dfrac/tfrac/cfrac share that syntax. Roots: `\sqrt{x}`, `\sqrt[3]{x}`. Paired delimiters: `\left(a+b\right)`.
- One braced text argument: text, mathrm, operatorname, mathit, mathbf, boldsymbol, mathsf, mathtt, mathbb, mathcal, mathfrak, textit, textbf, textrm, textup. No nested math expansion/full TeX fonts.
- Prefix these operator/function names with a backslash: sum, prod, coprod, int, iint, iiint, oint, bigcup, bigcap, bigoplus, bigotimes, lim, liminf, limsup, max, min, sup, inf, log, ln, exp, sin, cos, tan, cot, sec, csc, arcsin, arccos, arctan, sinh, cosh, tanh, deg, ker, dim, det, arg, Pr, gcd. Limits use `_{lower}^{upper}`.
- One braced accent argument: hat, acute, dot, ddot, tilde, grave, breve, check, vec, bar, overline, overrightarrow, widehat, widetilde. Unicode Greek/math symbols are valid (α β θ ≤ ≥ × ∞). Use Unicode/listed structures for other symbols; no invented macros/packages.
- Environments: matrix, pmatrix, bmatrix, vmatrix, Vmatrix, cases, aligned, align, alignedat, array. Match `\begin{NAME}`/`\end{NAME}`; `&` separates columns, `\\` rows. Matrix rows need equal columns; cases needs two. Array ignores its column specification, e.g. `{cc}`. No column-count argument after `\begin{alignedat}`.

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

```json
{"version":4,"pageNumber":{"enabled":true,"format":"fraction"},"deck":{"title":"Example","theme":"yrkie-theme","slides":[{"id":"s1","size":{"width":960,"height":540,"unit":"pt"},"background":{"src":"yrkie-asset-data://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","fit":"cover","foreground":"light","overlay":{"opacity":0.3,"direction":"to-right"}},"blocks":[{"id":"h1","type":"heading","props":{"text":"Example heading"}},{"id":"g1","type":"layout-group","layout":{"variant":"columns","columns":2},"children":[{"id":"t1","type":"text","props":{"text":"She said \"yes\".\nThe next line."}},{"id":"st1","type":"stat","props":{"value":42,"label":"Count"}}]}]}]}}
```

```json
{"version":4,"pageNumber":{"enabled":false,"format":"number"},"deck":{"title":"Edge example","theme":"yrkie-theme","slides":[{"id":"s1","size":{"width":960,"height":540,"unit":"pt"},"layout":{"preset":"edge-media"},"blocks":[{"id":"edge","type":"layout-group","layout":{"variant":"edge-media","mediaPosition":"right","mediaRatio":0.4,"mediaShape":"fade","contentAlign":"center"},"children":[{"id":"copy","type":"layout-group","layout":{"variant":"stack","region":"content"},"children":[{"id":"h1","type":"heading","props":{"text":"Example heading"}},{"id":"t1","type":"text","props":{"text":"Example body"}}]},{"id":"image","type":"media","layout":{"region":"media"},"props":{"src":"yrkie-asset-data://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","alt":"Example image"}}]}]}]}}
```

## 6. Exact Leaf shapes: all 39 types

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
{"id":"n39","type":"contents","props":{"presentation":"cards:connected","items":[{"id":"entry-1","title":"Title","text":"Body","icon":"Target"},{"id":"entry-2","title":"Next","text":"Details"}],"itemColumns":"auto","itemLayout":"auto","columnPreference":4}},
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

| Image location | Required manifest imageType and ratio |
| --- | --- |
| Ordinary media/image-text | A matching authorized source; ordinary placement accepts content or decorative assets. |
| Slide background, even if disabled | decorative; 4:3 or 16:9. |
| Left/right edge media | decorative; 3:4, 4:5, or 9:16. |
| Top/bottom edge media | decorative; 4:3 or 16:9. |

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
