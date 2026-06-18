# React Hook Form Reference

## Contents

- useForm: mode
- useForm: defaultValues
- useForm return and useEffect dependencies
- Resources

## useForm: mode

Validation strategy before a user submits the form. The validation occurs during the onSubmit event, which is triggered by invoking the handleSubmit function.

- `mode: 'onSubmit'` Validation is triggered on the submit event. Inputs attach onChange event listeners to re-validate themselves
- `mode: 'onBlur'` - Validation is triggered on the blur event.
- `mode: 'onChange'` - Live feedback, preferred method

## useForm: defaultValues

```tsx
useForm({
  defaultValues: {
    firstName: "",
    lastName: "",
  },
});
```

Avoid providing `undefined` as a default value, as it conflicts with the default state of a controlled component.

Avoid using custom objects containing prototype methods, such as Moment or Luxon, as defaultValues.

## useForm return and useEffect dependencies

Adding the entire return value of `useForm` to a `useEffect` dependency list may lead to infinite loops. The recommended way is to pass destructured methods to the dependencies of an `useEffect`:

```tsx
const { reset } = useForm()

useEffect(() => {
  reset({ ... })
}, [reset])
```

## Resources

**Official docs** See https://react-hook-form.com/docs/useform
