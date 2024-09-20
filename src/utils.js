const crypto = require('crypto');
const { promisify } = require('util');

const randomBytesAsync = promisify(crypto.randomBytes);

function genSaltSync(rounds = 10) {
    const salt = crypto.randomBytes(16).toString('hex');
    return `\$2b\$${rounds}\$${salt}`;
}

async function genSalt(rounds = 10) {
    const saltBuffer = await randomBytesAsync(16);
    const salt = saltBuffer.toString('hex');
    return `\$2b\$${rounds}\$${salt}`;
}

function hashPasswordSync(password, salt) {
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash;
}

async function hashPassword(password, salt) {
    const hashBuffer = await promisify(crypto.pbkdf2)(password, salt, 10000, 64, 'sha512');
    return hashBuffer.toString('hex');
}

function comparePasswordSync(password, hashedPassword) {
    const hash = hashPasswordSync(password, hashedPassword.split('$').slice(-2, -1).join('$'));
    return hashedPassword === hash;
}

async function comparePassword(password, hashedPassword) {
    const salt = hashedPassword.split('$').slice(-2, -1).join('$');
    const hash = await hashPassword(password, salt);
    return hashedPassword === hash;
}

module.exports = {
    genSaltSync,
    genSalt,
    hashPasswordSync,
    hashPassword,
    comparePasswordSync,
    comparePassword
};
