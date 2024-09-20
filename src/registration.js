const { hashPassword, genSalt, genSaltSync } = require('./utils');
const bodyParser = require('body-parser');
const InMemoryStorage = require('./inMemoryStorage');

class RegistrationModule {
    constructor(storage) {
        this.storage = storage;
        this.middleware = [];
        this.routes = [];
        this.use(bodyParser.json());
        this.use(bodyParser.urlencoded({ extended: true }));

        this.post('/register', async (req, res) => {
            const result = await this.registerUser(req, res);
            console.log("result", result);
            return result;
        });
    }

    use(middleware) {
        this.middleware.push(middleware);
    }

    post(route, handler) {
        const combinedHandler = async (req, res) => {
            try {
                for (const middleware of this.middleware) {
                    await middleware(req, res);
                }
                await handler(req, res);
            } catch (error) {
                console.error('Error:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        };
        this.routes.push({ method: 'post', path: route, handler: combinedHandler });
    }

    registerRoutes(app) {
        this.routes.forEach((route) => {
            const { method, path, handler } = route;
            app[method](path, async (req, res) => {
                try {
                    for (const middleware of this.middleware) {
                        await middleware(req, res);
                    }
                    await handler(req, res);
                } catch (error) {
                    console.error('Error:', error);
                    res.status(500).json({ error: 'Internal Server Error' });
                }
            });
        });
    }

    async registerUser(req, res) {
        const userData = req.body;
        const { username, email, password, ...additionalFields } = userData;

        if (!username || !password || !email) {
            return res.status(400).json({ error: 'Username, email, and password are required fields.' });
        }

        const usernameValidationError = !this.validateUsername(username);
        if (usernameValidationError) {
            return res.status(400).json({ error: usernameValidationError.message || 'Invalid username.' });
        }

        const emailValidationError = !this.validateEmail(email);
        if (emailValidationError) {
            return res.status(400).json({ error: emailValidationError.message || 'Invalid email.' });
        }

        const passwordValidationError = !this.validatePassword(password);
        if (passwordValidationError) {
            return res.status(400).json({ error: passwordValidationError.message || 'Invalid password.' });
        }

        const additionalFieldsValidationError = this.validateAdditionalFields(additionalFields);
        if (additionalFieldsValidationError) {
            return res.status(400).json({ error: additionalFieldsValidationError.message || 'Invalid additional fields.' });
        }

        try {
            const salt = process.env.USE_ASYNC ? await genSalt() : genSaltSync();
            const hashedPassword = process.env.USE_ASYNC
                ? await hashPassword(password, salt)
                : hashPassword(password, salt);

            const newUser = { username, email, password: await hashedPassword, ...additionalFields };
            return new Promise((resolve, reject) => {
                this.storage.save(newUser, (err) => {
                    if (err) {
                        console.error('Error saving data:', err);
                        reject({ error: 'Internal Server Error' });
                    } else {
                        const result = {
                            message: 'Registration successful',
                            user: newUser,
                        };
                        resolve(result);
                    }
                });
            });
        } catch (error) {
            console.error('Error during registration:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }

    }

    validateAdditionalFields(additionalFields) {
        const fieldValidations = {
            firstname: { validator: this.validateLength, params: { min: 1, max: 8 } },
            lastname: { validator: this.validateLength, params: { min: 1, max: 8 } },
            number: { validator: this.validatePhoneNumber, params: {} },
            gender: { validator: this.validateGender, params: {} },
            age: { validator: this.validateAge, params: {} },
            address: { validator: this.validateLength, params: { min: 1, max: 100 } },
            phoneNumber: { validator: this.validatePhoneNumber, params: {} },
        };

        for (const fieldName in additionalFields) {
            if (additionalFields.hasOwnProperty(fieldName)) {
                const validationFunction = this[`validate${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`];
                if (validationFunction) {
                    const fieldValidationResult = validationFunction(additionalFields[fieldName]);
                    if (!fieldValidationResult) {
                        return new Error(`Invalid ${fieldName}.`);
                    }
                } else if (fieldValidations[fieldName]) {
                    const { validator, params } = fieldValidations[fieldName];
                    if (!validator(additionalFields[fieldName], params)) {
                        return new Error(`Invalid ${fieldName}.`);
                    }
                }
            }
        }

        return null;
    }

    validateUsername(username) {
        return /^[a-zA-Z0-9]{8,}$/.test(username);
    }

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    validateLength(value, { min, max }) {
        return typeof value === 'string' && value.length >= min && value.length <= max;
    }

    validatePhoneNumber(number) {
        return /^\d{10}$/.test(number);
    }

    validateGender(gender) {
        return typeof gender === 'string' && ['male', 'female', 'other'].includes(gender.toLowerCase());
    }

    validatePassword(password) {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]*$/;
        return regex.test(password) && password.length >= 8;
    }

    validateFirstname(firstname) {
        return typeof firstname === 'string' && firstname.length >= 1 && firstname.length <= 8;
    }

    validateLastname(lastname) {
        return typeof lastname === 'string' && lastname.length >= 1 && lastname.length <= 8;
    }

    validateNumber(number) {
        return typeof number === 'number' && /^\d+$/.test(number);
    }

    validateAge(age) {
        const numericAge = parseInt(age, 10);
        return !isNaN(numericAge) && numericAge >= 18 && numericAge <= 100;
    }

    getValidationFunctions() {
        return Object.entries(Object.getPrototypeOf(this))
            .filter(([key, value]) => typeof value === 'function' && key.startsWith('validate'))
            .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    }
}

const inMemoryStorage = new InMemoryStorage();
const registrationModule = new RegistrationModule(inMemoryStorage);

module.exports = registrationModule;
