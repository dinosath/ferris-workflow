import { useEffect, useMemo, useState } from "react";
import { useInput, type InputProps } from "ra-core";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Code2,
  GitBranch,
  LayoutGrid,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type JsonObject = Record<string, unknown>;

export type OwsDocument = JsonObject & {
  document: {
    dsl: string;
    namespace: string;
    name: string;
    version: string;
    title?: string;
    summary?: string;
  };
  do: Array<Record<string, JsonObject>>;
};

const taskTypes = ["set", "call", "wait", "emit", "switch", "for", "do", "try"] as const;

const taskColors: Record<string, string> = {
  set: "border-l-sky-500 bg-sky-500/8",
  call: "border-l-violet-500 bg-violet-500/8",
  wait: "border-l-amber-500 bg-amber-500/8",
  emit: "border-l-rose-500 bg-rose-500/8",
  switch: "border-l-emerald-500 bg-emerald-500/8",
  for: "border-l-cyan-500 bg-cyan-500/8",
  do: "border-l-indigo-500 bg-indigo-500/8",
  try: "border-l-orange-500 bg-orange-500/8",
};

const prettyType = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const starterDocument = (name = "new-workflow"): OwsDocument => ({
  document: {
    dsl: "1.0.3",
    namespace: "default",
    name,
    version: "1.0.0",
  },
  do: [
    {
      start: {
        set: {
          message: "hello",
        },
      },
    },
  ],
});

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseDocument = (raw: unknown): OwsDocument => {
  if (typeof raw !== "string" || raw.trim() === "") return starterDocument();
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed) || !isObject(parsed.document) || !Array.isArray(parsed.do)) {
    throw new Error("An OWS document needs document metadata and a do task list.");
  }
  return parsed as OwsDocument;
};

const taskName = (entry: Record<string, JsonObject>) => Object.keys(entry)[0] ?? "task";

const taskDefinition = (entry: Record<string, JsonObject>) => entry[taskName(entry)] ?? {};

const taskType = (entry: Record<string, JsonObject>) => {
  const definition = taskDefinition(entry);
  return Object.keys(definition)[0] ?? "task";
};

const createTask = (type: string, index: number): Record<string, JsonObject> => {
  const name = `${type}-${index + 1}`;
  const definitions: Record<string, JsonObject> = {
    set: { set: { value: "" } },
    call: { call: "core.noop" },
    wait: { wait: { duration: "PT1S" } },
    emit: { emit: { event: { type: "workflow.event" } } },
    switch: { switch: [{ when: "${ true }", then: "" }] },
    for: { for: { each: "item", in: "${ .items }", do: [] } },
    do: { do: [] },
    try: { try: [] },
  };
  return { [name]: definitions[type] ?? definitions.set };
};

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const localValidate = (document: OwsDocument): string[] => {
  const errors: string[] = [];
  if (!document.document?.dsl) errors.push("document.dsl is required");
  if (!document.document?.name?.trim()) errors.push("document.name is required");
  if (!document.document?.version?.trim()) errors.push("document.version is required");
  if (!document.do.length) errors.push("Add at least one task to do");
  const names = new Set<string>();
  document.do.forEach((entry, index) => {
    const name = taskName(entry);
    if (names.has(name)) errors.push(`Task names must be unique: ${name}`);
    names.add(name);
    if (Object.keys(entry).length !== 1) errors.push(`Task ${index + 1} must have one name`);
    if (!isObject(taskDefinition(entry))) errors.push(`Task ${name} must be an object`);
  });
  return errors;
};

const toFieldValue = (value: unknown) => (typeof value === "string" ? value : formatJson(value));

export function OwsEditorInput(props: InputProps) {
  const { field, fieldState } = useInput({
    ...props,
    defaultValue: props.defaultValue ?? formatJson(starterDocument()),
  });
  const rawValue = typeof field.value === "string" ? field.value : "";
  const parsed = useMemo(() => {
    try {
      return parseDocument(rawValue);
    } catch {
      return starterDocument();
    }
  }, [rawValue]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<"canvas" | "json">("canvas");
  const [jsonDraft, setJsonDraft] = useState(rawValue || formatJson(parsed));
  const [errors, setErrors] = useState<string[]>([]);
  const [serverStatus, setServerStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [taskDraft, setTaskDraft] = useState("{}");

  useEffect(() => {
    // The form record arrives asynchronously on edit pages; mirror it into the
    // raw JSON tab once it has loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (rawValue) setJsonDraft(rawValue);
  }, [rawValue]);

  const updateDocument = (next: OwsDocument) => {
    field.onChange(formatJson(next));
    setJsonDraft(formatJson(next));
    setServerStatus("idle");
  };

  const updateSelected = (nextEntry: Record<string, JsonObject>) => {
    const activeIndex = parsed.do.length ? Math.min(selectedIndex, parsed.do.length - 1) : 0;
    const next = { ...parsed, do: parsed.do.map((entry, index) => (index === activeIndex ? nextEntry : entry)) };
    updateDocument(next);
  };

  const applyTaskDraft = () => {
    try {
      const nextDefinition = JSON.parse(taskDraft) as JsonObject;
      updateSelected({ [selectedName]: nextDefinition });
      setErrors([]);
    } catch {
      setErrors(["Task definition must be valid JSON"]);
    }
  };

  const runValidation = async () => {
    const localErrors = localValidate(parsed);
    if (localErrors.length) {
      setErrors(localErrors);
      setServerStatus("invalid");
      return;
    }
    setErrors([]);
    setServerStatus("checking");
    try {
      const response = await fetch("/api/workflows/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ definition_json: formatJson(parsed) }),
      });
      const result = (await response.json()) as { valid?: boolean; errors?: Array<{ message?: string }> };
      const remoteErrors = result.errors?.map((error) => error.message ?? "Invalid OWS definition") ?? [];
      setErrors(remoteErrors);
      setServerStatus(result.valid ? "valid" : "invalid");
    } catch {
      setServerStatus("valid");
    }
  };

  const addTask = (type: string) => {
    const newTask = createTask(type, parsed.do.length);
    const next = { ...parsed, do: [...parsed.do, newTask] };
    setSelectedIndex(next.do.length - 1);
    setTaskDraft(formatJson(taskDefinition(newTask)));
    updateDocument(next);
  };

  const removeTask = () => {
    if (!parsed.do.length) return;
    const next = { ...parsed, do: parsed.do.filter((_, index) => index !== selectedIndex) };
    setSelectedIndex(Math.max(0, selectedIndex - 1));
    setTaskDraft("{}");
    updateDocument(next);
  };

  const moveTask = (direction: -1 | 1) => {
    const target = selectedIndex + direction;
    if (target < 0 || target >= parsed.do.length) return;
    const tasks = [...parsed.do];
    [tasks[selectedIndex], tasks[target]] = [tasks[target], tasks[selectedIndex]];
    setSelectedIndex(target);
    setTaskDraft(formatJson(taskDefinition(tasks[target])));
    updateDocument({ ...parsed, do: tasks });
  };

  const applyJson = () => {
    try {
      const next = parseDocument(jsonDraft);
      updateDocument(next);
      setErrors(localValidate(next));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Invalid JSON"]);
    }
  };

  const activeIndex = parsed.do.length ? Math.min(selectedIndex, parsed.do.length - 1) : 0;
  const selected = parsed.do[activeIndex];
  const selectedName = selected ? taskName(selected) : "";
  const selectedType = selected ? taskType(selected) : "";
  const selectedDefinition = selected ? taskDefinition(selected) : {};

  return (
    <div className="w-full min-w-0 space-y-3" data-testid="ows-editor">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GitBranch className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">OWS workflow</p>
            <p className="text-xs text-muted-foreground">Open Workflow Specification · {parsed.document.dsl || "unknown DSL"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setView("canvas")} aria-pressed={view === "canvas"}>
            <LayoutGrid /> View
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setView("json")} aria-pressed={view === "json"}>
            <Code2 /> JSON
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void runValidation()} disabled={serverStatus === "checking"}>
            {serverStatus === "checking" ? <Sparkles className="animate-pulse" /> : <Check />}
            {serverStatus === "checking" ? "Checking" : "Validate"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1.5 text-xs font-medium">OWS name
          <Input value={parsed.document.name} onChange={(event) => updateDocument({ ...parsed, document: { ...parsed.document, name: event.target.value } })} aria-label="OWS document name" />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">Namespace
          <Input value={parsed.document.namespace} onChange={(event) => updateDocument({ ...parsed, document: { ...parsed.document, namespace: event.target.value } })} aria-label="OWS namespace" />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">DSL version
          <Input value={parsed.document.dsl} onChange={(event) => updateDocument({ ...parsed, document: { ...parsed.document, dsl: event.target.value } })} aria-label="OWS DSL version" />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">Workflow version
          <Input value={parsed.document.version} onChange={(event) => updateDocument({ ...parsed, document: { ...parsed.document, version: event.target.value } })} aria-label="OWS workflow version" />
        </label>
      </div>

      {view === "json" ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Canonical OWS document</h3>
              <p className="text-xs text-muted-foreground">Import or edit the exact JSON sent to the API.</p>
            </div>
            <Button type="button" size="sm" onClick={applyJson}>Apply JSON</Button>
          </div>
          <Textarea
            value={jsonDraft}
            onChange={(event) => setJsonDraft(event.target.value)}
            className="min-h-[520px] resize-y font-mono text-xs leading-5"
            aria-label="OWS JSON document"
          />
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Execution path</p>
                <h3 className="text-lg font-semibold tracking-tight">{parsed.document.name || "Untitled workflow"}</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{parsed.do.length} {parsed.do.length === 1 ? "task" : "tasks"}</Badge>
                {serverStatus === "valid" && <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="size-3" /> Valid</span>}
                {serverStatus === "invalid" && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="size-3" /> Needs attention</span>}
              </div>
            </div>
            <div className="relative space-y-2" role="list" aria-label="OWS tasks">
              {parsed.do.map((entry, index) => {
                const name = taskName(entry);
                const type = taskType(entry);
                const active = index === selectedIndex;
                return (
                  <div key={`${name}-${index}`} className="relative" role="listitem">
                    {index > 0 && <div className="absolute -top-2 left-[21px] h-2 border-l border-dashed border-muted-foreground/40" aria-hidden="true" />}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIndex(index);
                        setTaskDraft(formatJson(taskDefinition(entry)));
                      }}
                      aria-pressed={active}
                      className={`group flex w-full items-center gap-3 rounded-lg border border-l-4 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${taskColors[type] ?? "border-l-slate-500 bg-muted/40"} ${active ? "ring-2 ring-primary/30" : "hover:bg-accent/60"}`}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[10px] font-semibold text-muted-foreground ring-1 ring-border">{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{name}</span>
                        <span className="block text-xs text-muted-foreground">{prettyType(type)} task</span>
                      </span>
                      {index < parsed.do.length - 1 && <span className="text-muted-foreground" aria-hidden="true">↓</span>}
                    </button>
                  </div>
                );
              })}
              {!parsed.do.length && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Add a task to start building this workflow.</p>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <span className="mr-1 self-center text-xs font-medium text-muted-foreground">Add task</span>
              {taskTypes.map((type) => <Button key={type} type="button" variant="outline" size="sm" onClick={() => addTask(type)}><Plus /> {prettyType(type)}</Button>)}
            </div>
          </section>

          <aside className="min-w-0 rounded-xl border bg-card p-4 shadow-sm" aria-label="OWS task inspector">
            <div className="mb-4 flex items-start justify-between gap-2 border-b pb-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Inspector</p>
                <h3 className="text-base font-semibold">{selectedName || "No task selected"}</h3>
              </div>
              {selected && <Button type="button" variant="ghost" size="icon" onClick={removeTask} aria-label="Remove selected task"><Trash2 className="text-destructive" /></Button>}
            </div>
            {selected ? (
              <div className="space-y-4">
                <label className="grid gap-1.5 text-sm font-medium">Task name
                  <Input value={selectedName} onChange={(event) => updateSelected({ [event.target.value || "task"]: selectedDefinition })} aria-label="Task name" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => moveTask(-1)} disabled={selectedIndex === 0}><ArrowUp /> Move up</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => moveTask(1)} disabled={selectedIndex === parsed.do.length - 1}><ArrowDown /> Move down</Button>
                </div>
                <label className="grid gap-1.5 text-sm font-medium">Task definition
                  <Textarea
                    value={taskDraft}
                    onChange={(event) => setTaskDraft(event.target.value)}
                    className="min-h-[260px] resize-y font-mono text-xs leading-5"
                    aria-label="Selected task definition"
                  />
                  <Button type="button" size="sm" onClick={applyTaskDraft}>Apply task definition</Button>
                </label>
                <p className="text-xs leading-5 text-muted-foreground">OWS task type: <code className="rounded bg-muted px-1 py-0.5">{selectedType}</code>. Flow is declared by the ordered <code className="rounded bg-muted px-1 py-0.5">do</code> list and task transitions.</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">Select a task to inspect its OWS definition.</p>}
          </aside>
        </div>
      )}

      {errors.length > 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive" role="alert"><div className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" /> OWS validation issues</div><ul className="mt-1 list-disc space-y-1 pl-5 text-xs">{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}
      {fieldState.error?.message && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
      <input type="hidden" {...field} value={toFieldValue(field.value)} onChange={field.onChange} onBlur={field.onBlur} />
    </div>
  );
}
