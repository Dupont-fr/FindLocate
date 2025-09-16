const bcrypt = require('bcrypt')
const User = require('../models/user')
const assert = require('node:assert')
const { test, after, beforeEach, describe, before } = require('node:test')
const mongoose = require('mongoose')
const supertest = require('supertest')
const app = require('../app')
const helper = require('../utils/test_helper')

const api = supertest(app)

before(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI)
})

describe('when there is initially two users in db', () => {
    beforeEach(async () => {
        await User.deleteMany({})

        const passwordHash = await bcrypt.hash('sekret', 10)
        const user01 = new User({ username: 'root', passwordHash })
        const user02 = new User({ username: 'theblackmamba08', passwordHash })

        await user01.save()
        await user02.save()
    })
    test('all users are returned as json', async () => {
        const response = await api
            .get('/api/users')
            .expect(200)
            .expect('Content-Type', /application\/json/)
        assert.strictEqual(response.body.length, 2)
    })

    test('all users are returned with an id property', async () => {
        const response = await api
            .get('/api/users')
            .expect(200)
            .expect('Content-Type', /application\/json/)

        const allHaveIdProp = response.body.every((user) => 'id' in user)
        assert.strictEqual(response.body.length, 2)
        assert.equal(allHaveIdProp, true)
    })

    test('a specific user is within the returned users', async () => {
        const response = await api.get('/api/users')
        const usernames = response.body.map((e) => e.username)
        assert(usernames.includes('root'))
    })

    describe('addition of a new user', () => {
        test('creation succeeds with a valid fresh username', async () => {
            const usersAtStart = await helper.usersInDb()

            const newUser = {
                username: 'mluukkai',
                name: 'Matti Luukkainen',
                password: 'salainen',
            }

            await api
                .post('/api/users')
                .send(newUser)
                .expect(201)
                .expect('Content-Type', /application\/json/)

            const usersAtEnd = await helper.usersInDb()
            assert.strictEqual(usersAtEnd.length, usersAtStart.length + 1)

            const usernames = usersAtEnd.map((u) => u.username)
            assert(usernames.includes(newUser.username))
        })

        test('creation fails with proper statuscode and message if username is already taken', async () => {
            const usersAtStart = await helper.usersInDb()

            const newUser = {
                username: 'root',
                name: 'Superuser',
                password: 'salainen',
            }

            const result = await api
                .post('/api/users')
                .send(newUser)
                .expect(400)
                .expect('Content-Type', /application\/json/)

            const usersAtEnd = await helper.usersInDb()

            assert(result.body.error.includes('expected username to be unique'))
            assert.strictEqual(usersAtEnd.length, usersAtStart.length)
        })

        test('creation fails with proper statuscode and message if username is too short', async () => {
            const usersAtStart = await helper.usersInDb()

            const newUser = {
                username: 'ab', // moins de 3 caractères
                name: 'ShortNameUser',
                password: 'ValidPass123',
            }

            const result = await api
                .post('/api/users')
                .send(newUser)
                .expect(400)
                .expect('Content-Type', /application\/json/)

            const usersAtEnd = await helper.usersInDb()

            assert(
                result.body.error.includes(
                    'is shorter than the minimum allowed length'
                )
            )
            assert.strictEqual(usersAtEnd.length, usersAtStart.length)
        })

        test('creation fails with proper statuscode and message if username contains invalid characters', async () => {
            const usersAtStart = await helper.usersInDb()

            const newUser = {
                username: 'invalid!name', // contient un caractère "!" non autorisé
                name: 'InvalidCharUser',
                password: 'ValidPass123',
            }

            const result = await api
                .post('/api/users')
                .send(newUser)
                .expect(400)
                .expect('Content-Type', /application\/json/)

            const usersAtEnd = await helper.usersInDb()

            assert(
                result.body.error.includes(
                    'Only letters, numbers, and underscores are allowed'
                )
            )
            assert.strictEqual(usersAtEnd.length, usersAtStart.length)
        })

        test('creation fails with proper statuscode and message if username is missing', async () => {
            const usersAtStart = await helper.usersInDb()

            const newUser = {
                // username absent
                name: 'NoUsernameUser',
                password: 'ValidPass123',
            }

            const result = await api
                .post('/api/users')
                .send(newUser)
                .expect(400)
                .expect('Content-Type', /application\/json/)

            const usersAtEnd = await helper.usersInDb()

            assert(
                result.body.error.includes(
                    'User validation failed: username: Path `username` is required.'
                )
            )
            assert.strictEqual(usersAtEnd.length, usersAtStart.length)
        })

        test('creation fails if password is too short', async () => {
            const usersAtStart = await helper.usersInDb()

            const newUser = {
                username: 'validUser',
                name: 'ShortPasswordUser',
                password: 'Ab1', // trop court
            }

            const result = await api
                .post('/api/users')
                .send(newUser)
                .expect(400)
                .expect('Content-Type', /application\/json/)

            const usersAtEnd = await helper.usersInDb()

            assert(
                result.body.error.includes(
                    'Password must be at least 4 characters long'
                )
            )
            assert.strictEqual(usersAtEnd.length, usersAtStart.length)
        })

        test('creation fails if password is missing', async () => {
            const newUser = {
                username: 'validUser5',
                name: 'NoPasswordUser',
                // password manquant
            }

            const result = await api
                .post('/api/users')
                .send(newUser)
                .expect(400)

            assert(
                result.body.error.includes(
                    'Password must be at least 4 characters long'
                )
            )
        })
    })
})

after(async () => {
    await mongoose.connection.close()
})
