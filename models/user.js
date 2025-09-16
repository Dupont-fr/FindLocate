const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        minlength: 3,
        match: [
            /^[a-zA-Z0-9_]+$/,
            'Only letters, numbers, and underscores are allowed',
        ],
        required: true,
        unique: true,
    },
    name: String,
    passwordHash: {
        type: String,
        required: true,
    },
    blogs: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Blog',
        },
    ],
})

userSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
        // passwordHash should never be revealed
        delete returnedObject.passwordHash
    },
})

const User = mongoose.model('User', userSchema)

module.exports = User
