const { test, beforeEach, describe, after, before } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const supertest = require('supertest')
const bcrypt = require('bcrypt')
const app = require('../app')
const User = require('../models/user')
const jwt = require('jsonwebtoken')

const api = supertest(app)

before(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI)
})

describe('when there is initially one users in db', () => {
    beforeEach(async () => {
        await User.deleteMany({})

        const passwordHash = await bcrypt.hash('sekret', 10)
        const user = new User({ username: 'testuser', passwordHash })

        await user.save()
    })

    describe('login controller', () => {
        test('fails with invalid password', async () => {
            const loginData = {
                username: 'testuser',
                password: 'wrongpassword',
            }

            const result = await api
                .post('/api/login')
                .send(loginData)
                .expect(401)
                .expect('Content-Type', /application\/json/)
            assert.strictEqual(
                result.body.error,
                'invalid username or password'
            )
        })

        test('fails with non-existing user', async () => {
            const loginData = {
                username: 'unknownuser',
                password: 'whatever',
            }

            const result = await api
                .post('/api/login')
                .send(loginData)
                .expect(401)
                .expect('Content-Type', /application\/json/)
            assert.strictEqual(
                result.body.error,
                'invalid username or password'
            )
        })

        test('fails with status 400 if username is missing', async () => {
            const loginData = { password: 'sekret' } // pas de username

            const result = await api
                .post('/api/login')
                .send(loginData)
                .expect(400)
                .expect('Content-Type', /application\/json/)
            assert.strictEqual(
                result.body.error,
                'username and password are required'
            )
        })

        test('fails with status 400 if password is missing', async () => {
            const loginData = { username: 'testuser' } // pas de password

            const result = await api
                .post('/api/login')
                .send(loginData)
                .expect(400)
                .expect('Content-Type', /application\/json/)
            assert.strictEqual(
                result.body.error,
                'username and password are required'
            )
        })

        test('succeeds with valid credentials', async () => {
            const loginData = {
                username: 'testuser',
                password: 'sekret',
            }

            const result = await api
                .post('/api/login')
                .send(loginData)
                .expect(200)
                .expect('Content-Type', /application\/json/)
            assert.ok(result.body.token, 'token should be defined')
            assert.strictEqual(result.body.username, 'testuser')
        })

        test('login returns a valid JWT token', async () => {
            const loginData = { username: 'testuser', password: 'sekret' }

            const result = await api
                .post('/api/login')
                .send(loginData)
                .expect(200)
                .expect('Content-Type', /application\/json/)

            // Vérifier que le token est défini
            assert.ok(result.body.token, 'token should be defined')

            // Décoder le token avec la même clé que le backend
            const decoded = jwt.verify(result.body.token, process.env.SECRET)

            // Vérifier que le username correspond bien à l'utilisateur
            assert.strictEqual(decoded.username, 'testuser')

            // Vérifier que l'id est bien présent
            assert.ok(decoded.id, 'decoded token should contain user id')
        })
    })
})

after(async () => {
    await mongoose.connection.close()
})
