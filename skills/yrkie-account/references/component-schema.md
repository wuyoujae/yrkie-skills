# Yrkie DOE SlideEngine v4 Authoring Contract

SlideEngine Schema v4.21 · wire version: `4` · canvas: `960pt × 540pt` · authoring edition: `10`

## 0. Notation and ownership

- `R{...}` lists REQUIRED fields. Every required field is present and non-null.
- `O{...}` lists OPTIONAL fields. Omit an unused optional field.
- `A | B` is an exact, case-sensitive enum.
- `T[n..m]` is an array with `n–m` items; `number[a..b]` is inclusive.
- `=x` is the renderer default when an optional field is omitted.
- Required strings are non-empty. IDs are stable strings, not array indexes.
- Every object below is closed: emit only documented fields.

The AI authors content, semantics, and composition. The theme/runtime authors all visual styling and spacing. Emit `deck.theme:"yrkie-theme"` once; theme-owned fields are intentionally absent from this contract and must not be generated. The fields below are the complete authoring surface.

The Runtime also owns every setting whose editor default is Automatic. Omit those fields entirely; never emit a literal `"auto"`, a guessed column count, or a guessed image fit/ratio. The Runtime resolves them from component contracts, intrinsic media metadata, available width/height, and fit measurements.

## 1. Output invariants

1. Return exactly one complete `Root`, never a single-Slide root.
2. Return raw valid JSON only: no Markdown fence, prose, comments, functions, `undefined`, or trailing commas.
3. `deck.slides` exactly matches the confirmed Outline page count and order. Do not add, merge, omit, or reorder pages.
4. Root, Deck, Slide, Node, `props`, nested content, and layout objects reject unknown keys.
5. Every Slide ID is unique in the Deck; every Node ID is unique within its Slide.
6. Do not emit `null`, aliases, undocumented component types, Runtime metadata, editor state, theme-owned fields, or historical style fields.
7. Preserve authoritative Outline facts and asset references exactly. Never invent a media `src`.
8. Collection arrays always use the declared `props.content.*` path. Direct `props.items`, `props.stages`, `props.steps`, or `props.branches` is invalid.

### 1.1 Visual-capacity limits

Wire array bounds below describe what JSON can carry, not what one Slide can display. These stricter authoring limits override every wider wire bound:

- Titles use 1–2 authored lines; only a hero may use 3. After the title, use one focal structure and at most two short support modules. New output uses at most two nested Group levels.
- A full-width peer collection holds at most 4 `stat` or card items. A narrow rail inside `row`, `composition`, or edge content holds at most 2. Any collection with 3+ peers must own a full-width row; never place it beside another Group.
- `text`: emphasis ≤3 lines, content/describe ≤5. `list`: ≤4 items, or ≤6 only when it is the full-width focal structure; each item ≤2 lines. Card text ≤2 lines per item. `stat`: value 1 line, label ≤2, description ≤2.
- `table`: ≤6 body rows × ≤5 columns. Category charts: ≤8 categories × ≤3 series. Radar: ≤6 axes. Donut: ≤6 items. Risk and waterfall: ≤8 items. Flow/chevron/progress: ≤5 items. `timeline-arrow`: exactly 4 milestones. A `process-step` collection: 2–4 peers. Fishbone: ≤6 branches with ≤2 causes each.
- A chart, table, diagram, or media composition gets at most one adjacent short interpretation block. A media rail may pair with one short paragraph or a ≤3-item list, not paragraph + list + stat together.

If source material exceeds a limit, preserve its meaning by aggregating, shortening, or choosing a denser qualified component. Never solve fit by extra nesting, smaller text, clipping, overflow, or omitting a material fact.

## 2. Root, Slide, and Node

```ts
Root = R{
  version: 4,
  pageNumber: R{enabled:boolean, format:"number"|"fraction"},
  deck: R{title:string, theme:"yrkie-theme", slides:Slide[1..200]}
}

Slide = R{
  id:string,
  size:R{width:960, height:540, unit:"pt"},
  blocks:Node[1..2048]
}; O{background:Background, layout:EdgeSlideLayout}

Leaf = R{id:string, type:ComponentType, props:Props};
       O{layout:EdgeRegionLayout}; FORBIDDEN{kind,children}

Group = R{id:string, type:"layout-group", layout:GroupLayout, children:Node[1..24]};
        O{kind:"layout"|"container"|"collection"|"cluster"}; FORBIDDEN{props}

Node = Leaf | Group
```

`children` order is reading order and default visual order. The wire accepts Group depth 3 for historical compatibility; new output stops at depth 2. Use `container` for mixed components, `collection` for same-type peers, and `cluster` for a nested local composition.

## 3. Composition contracts

```ts
Region = "content"|"media"

EdgeSlideLayout = R{preset:"edge-media"}

Background = R{src:string}; O{
  fit:"cover"|"contain" = "contain",
  position:string = "50% 50%",
  overlay:false|O{
    opacity:number[0..0.9] = 0,
    direction:"to-right"|"to-left"|"to-bottom"|"to-top" = "to-right"
  }
}

EdgeRegionLayout = R{region:Region}

PrimarySplitLayout = R{
  variant:"composition",
  direction:"row",
  ratio:"balanced"|"primary-first"|"primary-second"
}; O{region:Region}

EdgeMediaLayout = R{
  variant:"edge-media",
  mediaPosition:"left"|"right"|"top"|"bottom"
}; O{contentAlign:"start"|"center"|"end" = "center"}

GroupLayout = {} | R{region:Region} | PrimarySplitLayout | EdgeMediaLayout
```

For ordinary Slides, omit `Slide.layout`. For ordinary Leaves, omit `layout`. For ordinary Groups, emit `layout:{}` and let the Runtime choose axis, variant, spans, columns, wrapping, alignment, and spacing. `kind` describes semantic grouping; it does not lock geometry.

The only ordinary-layout override is a deliberate two-child horizontal primary/secondary composition. Emit all three fields together. `balanced=1:1`, `primary-first=3:2`, and `primary-second=2:3`; child 0 is left. Use `balanced` only when both sides are genuinely equivalent in semantic importance, information volume, and visual load. Otherwise make the true focal side primary. Never add `columns`, `maxColumns`, `span`, or any other placement hint.

Edge media is the only preset exception. It requires `Slide.layout.preset:"edge-media"` and exactly one root Group with `variant:"edge-media"`; that Group is the Slide's only root block. It has exactly two direct children in reading order: one child marked `region:"content"` and one `media` Leaf marked `region:"media"`. `mediaPosition` selects the edge. `contentAlign` controls only the content region's vertical alignment; omit it for the centered default, and use `start` or `end` only when the composition deliberately needs top or bottom alignment. Rail ratio, seam, axis, fit, and media aspect are Runtime-owned and must be omitted. Never combine it with `Slide.background`.

## 4. Component contracts

```ts
ComponentType =
  "hero"|"heading"|"text"|"code-block"|"list"|"question-card"|
  "stat"|"quote"|"media"|"progress-list"|"table"|
  "grouped-bar-chart"|"line-chart"|"stacked-bar-chart"|"risk-matrix"|
  "waterfall-chart"|"stair-step-chart"|"radar-chart"|"donut-chart"|
  "circular-process-2"|"circular-process"|"circular-process-4"|"supply-chain-flow"|
  "timeline-arrow"|"process-step"|"chevron-list"|"capability-cards"|"numbered-icon-cards"|
  "fishbone-diagram"|"math-formula"
```

Choose the matching `props` contract for every Leaf. `R` and `O` apply recursively.

### 4.1 Narrative, code, and media

```ts
hero.props = R{title:string}; O{eyebrow:string, subtitle:string}

heading.props = R{text:string}; O{level:1|2|3, kicker:string}

text.props = R{text:string}; O{textRole:"emphasis"|"title"|"content"|"describe"}

code-block.props = R{code:string}; O{
  language:"python"|"javascript"|"typescript"|"json"|"html"|"css"|"sql"|"shell"|"text",
  wrap:boolean = true
}

list.props = R{items:string[1..100]}; O{title:string}

question-card.props = R{title:string}; O{index:string|number, text:string}

stat.props = R{value:string|number}; O{label:string, description:string}

quote.props = R{text:string}; O{source:string}

media.props = R{src:string, alt:string}
```

When `question-card.index` is omitted, the renderer derives `1,2,3...` from reading order. `stat.value` is one compact metric or numeric target, never a sentence or a milestone/date label. Use only authoritative asset references in `media.src`. Media format, fit, focal position, and aspect ratio are inferred automatically from the source and allocated slot; do not author them.

### 4.2 Progress and table

```ts
ProgressItem = R{title:string}
progress-list.props = R{content:R{items:ProgressItem[1..12]}}

TableCell = string|number|(R{text:string}; O{emphasis:"muted"|"highlight"})
TableColumn = R{header:string}; O{
  align:"left"|"center"|"right", locale:string, protectedTerms:string[]
}
TableRow = R{cells:TableCell[]}
SemanticWrap = O{locale:string, protectedTerms:string[]}

table.props = R{
  content:R{columns:TableColumn[1..12], rows:TableRow[1..100]}
}; O{
  ariaLabel:string,
  borderStyle:"grid"|"none"|"three-line",
  semanticWrap:false|SemanticWrap
}
```

Every row has exactly the same cell count as `content.columns`. `borderStyle` selects table structure only. Column sizing is always resolved automatically from content and available width.

### 4.3 Category charts

```ts
NumberFormat = O{valuePrefix:string, valueSuffix:string}
CategoryAxis = NumberFormat & O{maxValue:number, tickInterval:number}
TrendAxis = NumberFormat & O{
  includeZero:boolean, minValue:number, maxValue:number, tickInterval:number
}
Series = R{name:string, data:number[1..100]}
CategoryChartData = CategoryAxis & R{categories:string[1..100], series:Series[1..100]}

grouped-bar-chart.props = R{content:CategoryChartData}; O{subtitle:string, showLegend:boolean}

LineLabel = R{index:integer}; O{text:string|number}
LineSeries = Series & O{labels:LineLabel[]}
line-chart.props = R{
  content:TrendAxis & R{categories:string[1..100], series:LineSeries[1..100]}
}; O{showLegend:boolean, smooth:boolean}

StackAnnotation = R{label:string}; O{from:integer, to:integer}
stacked-bar-chart.props = R{
  content:CategoryAxis & R{categories:string[1..100], series:Series[1..100]}; O{
    showYAxis:boolean, showValues:boolean, legendReversed:boolean,
    annotation:StackAnnotation
  }
}; O{subtitle:string, showLegend:boolean}
```

Every `series.data.length` equals `categories.length`. Grouped and stacked bar values are non-negative; use `line-chart` or `waterfall-chart` for signed change. When both are supplied, `minValue <= maxValue`; every supplied `tickInterval > 0`. All indexes are zero-based and in range.

Chart components do not own a standalone headline. Use a separate `heading` or `text`. Supported subtitles, legend labels, donut center copy, and data labels remain legal; never create a duplicate manual legend.

### 4.4 Radar and donut

```ts
RadarAxis = R{label:string, max:number>0}
RadarDataset = R{name:string, values:number[3..8]}
radar-chart.props = R{
  content:R{axes:RadarAxis[3..8], datasets:RadarDataset[1..3]}
}; O{subtitle:string, showLegend:boolean}

DonutItem = R{label:string, value:number}; O{
  percentLabel:string, badge:string, primary:boolean,
  valueLabel:string|false, detailLabel:string
}
DonutCenter = O{title:string|string[], value:string|number, eyebrow:string, subtitle:string|string[]}
DonutFootnote = O{align:"left"|"right", text:string, lines:string[]}

donut-chart.props = R{
  content:R{items:DonutItem[2..6]}; O{
    variant:"standard"|"compact"|"hero", showLegend:boolean,
    center:DonutCenter, tag:string, footerLines:string[], footnotes:DonutFootnote[],
    valuePrefix:string, valueSuffix:string, maximumFractionDigits:integer[0..3]
  }
}
```

Every radar dataset has exactly one value per axis; each value is within `0..axis.max`. Donut values are non-negative and at least one item is greater than zero.

### 4.5 Risk and waterfall

```ts
RiskItem = R{label:string, x:number[0..1], y:number[0..1]}
PriorityZone = R{
  x:number[0..1], y:number[0..1], width:number[0..1], height:number[0..1]
}; O{
  label:string, labelLines:string[]
}
risk-matrix.props = R{
  content:R{items:RiskItem[1..100]}; O{
    xLabel:string, yLabel:string, priorityZone:PriorityZone
  }
}; O{subtitle:string}

WaterfallItem = R{label:string, value:number}; O{
  type:"change"|"total", connectToNext:boolean, showValue:boolean,
  valuePosition:"inside"|"above"|"badge"
}
WaterfallCallout = R{index:integer, text:string}; O{position:"above"|"below"}
WaterfallComparison = R{from:integer, to:integer, label:string}

waterfall-chart.props = R{
  content:TrendAxis & R{items:WaterfallItem[2..100]}; O{
    showYAxis:boolean, showValues:boolean, showChangeSigns:boolean,
    staggerLabels:boolean, footnote:string,
    callouts:WaterfallCallout[], comparisons:WaterfallComparison[]
  }
}; O{subtitle:string}

StairStep = R{value:number[0..100], label:string}
stair-step-chart.props = R{
  title:string,
  subtitle:string,
  content:R{steps:StairStep[4..4]}
}
```

Risk positions are normalized coordinates; a priority zone must also satisfy `x+width<=1` and `y+height<=1`. All waterfall indexes are zero-based and within `content.items`.
Stair-step values are percentages. The renderer owns the fixed four-node geometry, percent symbol, semantic typography, theme colors and aspect-preserving compression; never author styling or line geometry.

### 4.6 Flows and peer collections

```ts
CycleStep = R{label:string}
circular-process-2.props = R{content:R{steps:CycleStep[2..2]}}
circular-process.props = R{content:R{steps:CycleStep[3..3]}}
circular-process-4.props = R{content:R{steps:CycleStep[4..4]}}

TimelineItem = R{year:string,description:string}
timeline-arrow.props = R{content:R{items:TimelineItem[4..4]}}
process-step.props = R{title:string,items:string[1..4],duration:string}

SupplyStage = R{title:string}; O{description:string}
supply-chain-flow.props = R{content:R{stages:SupplyStage[2..6]}}; O{title:string}

ChevronItem = R{label:string}
chevron-list.props = R{content:R{items:ChevronItem[2..6]}}

CapabilityItem = R{title:string, text:string}; O{icon:string}
capability-cards.props = R{content:R{items:CapabilityItem[1..6]}}; O{
  title:string
}

IconPeerItem = R{title:string, text:string, icon:string}
numbered-icon-cards.props = R{content:R{items:IconPeerItem[2..6]}}; O{
  title:string
}
```

Cycle labels are compact stage names, not descriptions. The renderer owns arrow geometry, semantic typography, theme colors, and aspect-preserving compression; do not author line breaks or styling fields inside a cycle label.

`numbered-icon-cards` does not render sequence numbers; use it only for icon-led peer items. Semantic icon names are content choices.

### 4.7 Fishbone and formula

```ts
FishboneBranch = R{side:"upper"|"lower", title:string, items:string[1..3]}
fishbone-diagram.props = R{
  content:R{branches:FishboneBranch[2..8]}; O{
    upperLabel:string, lowerLabel:string
  }
}

FormulaContent = R{formula:string}; O{display:boolean, align:"left"|"center"|"right"}
math-formula.props = R{content:FormulaContent}
```

## 5. Minimal complete example

```json
{
  "version": 4,
  "pageNumber": {"enabled": true, "format": "fraction"},
  "deck": {
    "title": "2025 Business Review",
    "theme": "yrkie-theme",
    "slides": [
      {
        "id": "slide-01",
        "size": {"width": 960, "height": 540, "unit": "pt"},
        "blocks": [
          {"id": "title", "type": "heading", "props": {"text": "Growth Quality Improved", "level": 1}},
          {"id": "summary", "type": "text", "props": {"text": "Revenue grew while capital intensity declined.", "textRole": "content"}},
          {
            "id": "chart",
            "type": "grouped-bar-chart",
            "props": {
              "subtitle": "USD billions",
              "showLegend": true,
              "content": {
                "valuePrefix": "$",
                "categories": ["2024", "2025"],
                "series": [
                  {"name": "Revenue", "data": [92.8, 99.2]},
                  {"name": "Cash Flow", "data": [18.4, 23.6]}
                ]
              }
            }
          }
        ]
      }
    ]
  }
}
```
