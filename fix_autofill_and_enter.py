import re

with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
    app = f.read()

# Add components override to theme
components_str = """
		components: {
			MuiInputBase: {
				styleOverrides: {
					input: {
						'&:-webkit-autofill': {
							WebkitBoxShadow: mode === 'dark' ? '0 0 0 100px #121212 inset' : '0 0 0 100px #ffffff inset',
							WebkitTextFillColor: mode === 'dark' ? '#ffffff' : '#000000',
							caretColor: mode === 'dark' ? '#ffffff' : '#000000',
							borderRadius: 'inherit'
						}
					}
				}
			},
			MuiOutlinedInput: {
				styleOverrides: {
					root: {
						'&:-webkit-autofill': {
							borderRadius: 'inherit'
						}
					}
				}
			}
		},
"""

if 'MuiInputBase' not in app:
    app = app.replace('			error: { main: "#d32f2f" }\n		},', '			error: { main: "#d32f2f" }\n		},' + components_str)

with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app)


with open('client/src/pages/Auth.jsx', 'r', encoding='utf-8') as f:
    auth = f.read()

# Add handleKeyDown
handle_keydown = """
	const handleKeyDown = (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (isLogin) {
				handleSubmit();
			} else {
				if (activeStep === steps.length - 1) {
					handleSubmit();
				} else {
					handleNext();
				}
			}
		}
	};
"""
if 'handleKeyDown' not in auth:
    auth = auth.replace('const handleSubmit = async (e) => {', handle_keydown + '\n\tconst handleSubmit = async (e) => {')

# Add onKeyDown to TextFields in login and signup
auth = auth.replace('name="email" value={formData.email} onChange={handleChange} margin="normal" required />', 'name="email" value={formData.email} onChange={handleChange} onKeyDown={handleKeyDown} margin="normal" required />')
auth = auth.replace('name="password" value={formData.password} onChange={handleChange} margin="normal" required />', 'name="password" value={formData.password} onChange={handleChange} onKeyDown={handleKeyDown} margin="normal" required />')
auth = auth.replace('name="name" value={formData.name} onChange={handleChange} margin="normal" required autoFocus />', 'name="name" value={formData.name} onChange={handleChange} onKeyDown={handleKeyDown} margin="normal" required autoFocus />')

with open('client/src/pages/Auth.jsx', 'w', encoding='utf-8') as f:
    f.write(auth)
