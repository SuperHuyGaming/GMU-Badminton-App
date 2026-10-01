import jsxA11y from "eslint-plugin-jsx-a11y";
export default [
  jsxA11y.flatConfigs.recommended,
  {
    files: ["**/*.jsx", "**/*.js"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    }
  }
];
