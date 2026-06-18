# shadcn/ui Reference

## Contents

- Field component
- Displaying errors
- Input
- Textarea
- Select
- Checkbox
- Radio group
- Resources

## Field component

Uses React Hook Form's `useForm` hook for form state management.

`<Controller />` component for controlled inputs.

`<Field />` components for building accessible forms.

Client-side validation using Zod with `standardSchemaResolver`.

#### Basic example

```tsx
<Controller
  name="email"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={`${formId}-email`}>email</FieldLabel>
      <Input
        {...field}
        id={`${formId}-email`}
        aria-invalid={fieldState.invalid}
        placeholder="test@example.com"
        autoComplete="off"
        disabled={form.formState.isSubmitting}
      />
    </Field>
  )}
/>
```

## Displaying errors

Display errors next to the field using `<FieldError />`.

Add the data-invalid prop to the `<Field />` component.

Add the aria-invalid prop to the form control such as `<Input />`, `<SelectTrigger />`, `<Checkbox />`, etc.

```tsx
<Field data-invalid={fieldState.invalid}>
  <FieldLabel htmlFor={`${formId}-email`}>Email</FieldLabel>
  <Input
    {...field}
    id={`${formId}-email`}
    aria-invalid={fieldState.invalid}
    type="email"
  />
  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
</Field>
```

## Input

```tsx
<Controller
  name="name"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={`${formId}-name`}>name</FieldLabel>
      <Input
        {...field}
        id={`${formId}-name`}
        aria-invalid={fieldState.invalid}
        placeholder="test@example.com"
        disabled={form.formState.isSubmitting}
      />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

## Textarea

```tsx
<Controller
  name="about"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={`${formId}-about`}>about</FieldLabel>
      <Textarea
        {...field}
        id={`${formId}-about`}
        aria-invalid={fieldState.invalid}
        placeholder="I'm a software engineer..."
        className="min-h-[120px]"
      />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

## Select

```tsx
<Controller
  name="language"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field orientation="responsive" data-invalid={fieldState.invalid}>
      <FieldContent>
        <FieldLabel htmlFor={`${formId}-select`}>Spoken Language</FieldLabel>
        <FieldDescription>
          For best results, select the language you speak.
        </FieldDescription>
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </FieldContent>
      <Select
        name={field.name}
        value={field.value}
        onValueChange={field.onChange}
      >
        <SelectTrigger
          id={`${formId}-select`}
          aria-invalid={fieldState.invalid}
          className="min-w-[120px]"
        >
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent position="item-aligned">
          <SelectItem value="auto">Auto</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  )}
/>
```

## Checkbox

```tsx
<Controller
  name="tasks"
  control={form.control}
  render={({ field, fieldState }) => (
    <FieldSet>
      <FieldLegend variant="label">Tasks</FieldLegend>
      <FieldDescription>
        Get notified when tasks you&apos;ve created have updates.
      </FieldDescription>
      <FieldGroup data-slot="checkbox-group">
        {tasks.map((task) => (
          <Field
            key={task.id}
            orientation="horizontal"
            data-invalid={fieldState.invalid}
          >
            <Checkbox
              id={`${formId}-task-${task.id}`}
              name={field.name}
              aria-invalid={fieldState.invalid}
              checked={field.value.includes(task.id)}
              onCheckedChange={(checked) => {
                const newValue = checked
                  ? [...field.value, task.id]
                  : field.value.filter((value) => value !== task.id);
                field.onChange(newValue);
              }}
            />
            <FieldLabel
              htmlFor={`${formId}-task-${task.id}`}
              className="font-normal"
            >
              {task.label}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </FieldSet>
  )}
/>
```

## Radio group

```tsx
<Controller
  name="plan"
  control={form.control}
  render={({ field, fieldState }) => (
    <FieldSet>
      <FieldLegend>Plan</FieldLegend>
      <FieldDescription>
        You can upgrade or downgrade your plan at any time.
      </FieldDescription>
      <RadioGroup
        name={field.name}
        value={field.value}
        onValueChange={field.onChange}
      >
        {plans.map((plan) => (
          <FieldLabel key={plan.id} htmlFor={`${formId}-plan-${plan.id}`}>
            <Field orientation="horizontal" data-invalid={fieldState.invalid}>
              <FieldContent>
                <FieldTitle>{plan.title}</FieldTitle>
                <FieldDescription>{plan.description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem
                value={plan.id}
                id={`${formId}-plan-${plan.id}`}
                aria-invalid={fieldState.invalid}
              />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </FieldSet>
  )}
/>
```

## Resources

Use the Shadcn:get_item_examples_from_registries when:

1. You need a pattern NOT listed above

**Official docs**: See https://ui.shadcn.com/docs/forms/react-hook-form
