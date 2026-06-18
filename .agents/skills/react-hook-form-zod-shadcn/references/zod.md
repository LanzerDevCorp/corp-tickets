# Zod Reference

## Contents

- Error handling
- Strings
- Arrays
- Inferring types
- Resources

### Error handling

Always use `{ error: "message" }` format to report error messages.

```tsx
z.string().trim().min(5, { error: "Must be at least 5 characters." });
```

### Strings

When validating strings, always use `.trim()` to avoid leading/trailing whitespace issues.

```tsx
z.string().trim().min(5, { error: "Must be at least 5 characters." });
```

Also, don't suggest a max value unless there is a specific reason for it.

When a string property is optional use a union instead of `.optional()` to ensure proper validation:

```tsx
z.string()
  .trim()
  .min(5, { error: "Must be at least 5 characters." })
  .or(z.literal(""));
```

To validate email addresses:

```tsx
z.email({ error: "Please enter a valid email address" });
```

To validate any WHATWG-compatible URL:

```tsx
z.url({ error: "Invalid URL" });
```

### Arrays

When an array property is required use the `.nonempty()` method to ensure proper validation:

```tsx
z.array(z.string().trim()).nonempty({
  error: "At least one element must be provided",
});
```

### Inferring types

Proper TypeScript types using `z.infer<typeof schema>`

```tsx
const Player = z.object({
  username: z.string(),
  xp: z.number(),
});

// extract the inferred type
type Player = z.infer<typeof Player>;
```

### Resources

Use the InkeepMcp:ask_question_about_zod_v4 when

1. You need a validation pattern NOT listed above
2. You need to combine multiple validators in an unfamiliar way
3. You're unsure about a specific method's v4 syntax
4. You need advanced features (transforms, preprocessors, etc.)

**Official docs**: See https://zod.dev/api
