const assert = require('node:assert')
const { test, after, beforeEach, describe, before } = require('node:test')
const mongoose = require('mongoose')
const supertest = require('supertest')
const app = require('../app')
const helper = require('../utils/test_helper')
const Blog = require('../models/blog')
const User = require('../models/user')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const api = supertest(app)

const getUserAndToken = async (pass) => {
    const passwordHash = await bcrypt.hash(pass, 10)
    const user = new User({
        username: pass,
        name: pass,
        passwordHash,
    })
    await user.save()

    const token = jwt.sign(
        { username: user.username, id: user._id },
        process.env.SECRET,
        { expiresIn: 60 * 5 }
    )

    return {
        user,
        token,
    }
}

before(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI)
})

describe('when there is initially some blogs saved by a user', () => {
    beforeEach(async () => {
        await Blog.deleteMany({})
        await User.deleteMany({})

        const passwordHash = await bcrypt.hash('sekret', 10)
        const user = new User({
            username: 'testuser',
            name: 'Test User',
            passwordHash,
        })
        await user.save()

        await Blog.insertMany(
            helper.initialBlogs.map((blog) => ({
                ...blog,
                user: user._id.toString(),
            }))
        )
    })

    test('all blogs are returned as json', async () => {
        const response = await api
            .get('/api/blogs')
            .expect(200)
            .expect('Content-Type', /application\/json/)
        assert.strictEqual(response.body.length, helper.initialBlogs.length)
    })

    test('all blogs are returned with an id property', async () => {
        const response = await api
            .get('/api/blogs')
            .expect(200)
            .expect('Content-Type', /application\/json/)

        const allHaveIdProp = response.body.every((blog) => 'id' in blog)
        assert.strictEqual(response.body.length, helper.initialBlogs.length)
        assert.equal(allHaveIdProp, true)
    })

    test('a specific blog is within the returned blogs', async () => {
        const response = await api.get('/api/blogs')
        const titles = response.body.map((e) => e.title)
        assert(titles.includes('Understanding MongoDB with Mongoose'))
    })

    describe('addition of a new blog', () => {
        test('a valid blog can be added', async () => {
            const { user, token } = await getUserAndToken('theblackmamba08')

            const newBlog = {
                title: 'Introduction express',
                author: 'adoum',
                url: 'https://fullstackopenclassrooms.com/nodejs',
                likes: 12,
                user: user._id,
            }

            await api
                .post('/api/blogs')
                .set('Authorization', `Bearer ${token}`)
                .send(newBlog)
                .expect(201)
                .expect('Content-Type', /application\/json/)

            const blogsAtEnd = await helper.blogsInDb()
            assert.strictEqual(
                blogsAtEnd.length,
                helper.initialBlogs.length + 1
            )

            const titles = blogsAtEnd.map((n) => n.title)
            assert(titles.includes('Introduction express'))
        })

        test('a blog without likes is set to zero', async () => {
            const { user, token } = await getUserAndToken('theblackmamba08')

            const newBlog = {
                title: 'Introduction Mongoose',
                author: 'adoum',
                url: 'https://fullstackopenclassrooms.com/nodejs',
                user: user._id,
            }

            const response = await api
                .post('/api/blogs')
                .set('Authorization', `Bearer ${token}`)
                .send(newBlog)
                .expect(201)
                .expect('Content-Type', /application\/json/)

            const blogsAtEnd = await helper.blogsInDb()
            assert.strictEqual(
                blogsAtEnd.length,
                helper.initialBlogs.length + 1
            )

            const titles = blogsAtEnd.map((n) => n.title)
            assert(titles.includes('Introduction Mongoose'))
            assert(response.body.likes === 0)
        })

        test('blog without title or/and url is not added', async () => {
            const { user, token } = await getUserAndToken('theblackmamba08')

            const newBlog = {
                author: 'adoum',
                user: user._id,
            }

            await api
                .post('/api/blogs')
                .set('Authorization', `Bearer ${token}`)
                .send(newBlog)
                .expect(400)
                .expect('Content-Type', /application\/json/)

            const blogsAtEnd = await helper.blogsInDb()
            assert.strictEqual(blogsAtEnd.length, helper.initialBlogs.length)
        })
    })

    describe('update of a blog', () => {
        test('an existing blog can be updated', async () => {
            const blogsAtStart = await helper.blogsInDb()
            const blogToUpdate = blogsAtStart[0]
            const updateRequest = {
                likes: 50,
            }

            const response = await api
                .put(`/api/blogs/${blogToUpdate.id}`)
                .send(updateRequest)
                .expect(200)
                .expect('Content-Type', /application\/json/)

            const blogsAtEnd = await helper.blogsInDb()
            assert.strictEqual(blogsAtEnd.length, helper.initialBlogs.length)
            assert.strictEqual(response.body.likes, 50)
        })

        test('fails with statuscode 404 if blog does not exist', async () => {
            const validNonexistingId = await helper.nonExistingId()

            const updateRequest = {
                likes: 50,
            }

            await api
                .put(`/api/blogs/${validNonexistingId}`)
                .send(updateRequest)
                .expect(404)
        })
    })

    describe('viewing a specific blog', () => {
        test('a specific blog can be viewed', async () => {
            const blogsAtStart = await helper.blogsInDb()
            const blogToView = blogsAtStart[0]

            const resultBlog = await api
                .get(`/api/blogs/${blogToView.id}`)
                .expect(200)
                .expect('Content-Type', /application\/json/)

            assert.strictEqual(resultBlog.body.title, blogToView.title)
            assert.strictEqual(resultBlog.body.author, blogToView.author)
            assert.strictEqual(resultBlog.body.url, blogToView.url)
            assert.strictEqual(resultBlog.body.likes, blogToView.likes)
            assert.strictEqual(resultBlog.body.user, blogToView.user.toString())
            assert.strictEqual(resultBlog.body.id, blogToView.id)
        })

        test('fails with statuscode 404 if blog does not exist', async () => {
            const validNonexistingId = await helper.nonExistingId()

            await api.get(`/api/blogs/${validNonexistingId}`).expect(404)
        })

        test('fails with statuscode 400 if id is invalid', async () => {
            const invalidId = '5a3d5da59070081a82a3445'

            await api.get(`/api/blogs/${invalidId}`).expect(400)
        })
    })

    describe('deletion of a blog', () => {
        test('succeeds with status code 204 if deleted by creator', async () => {
            const { user, token } = await getUserAndToken('theblackmamba08')

            const newBlog = {
                title: 'Blog to delete',
                author: 'Author',
                url: 'http://example.com',
                likes: 5,
                user: user._id,
            }

            const createdBlog = await api
                .post('/api/blogs')
                .set('Authorization', `Bearer ${token}`)
                .send(newBlog)
                .expect(201)
                .expect('Content-Type', /application\/json/)

            await api
                .delete(`/api/blogs/${createdBlog.body.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(204)

            const blogsAtEnd = await helper.blogsInDb()
            assert(!blogsAtEnd.map((b) => b.title).includes('Blog to delete'))
            assert.strictEqual(blogsAtEnd.length, helper.initialBlogs.length)
        })

        test('fails with status code 403 if deleted by non-creator', async () => {
            const { user: userA, token: tokenA } = await getUserAndToken(
                'theblackmamba08'
            )
            const { token: tokenB } = await getUserAndToken('grafikart')

            const newBlog = {
                title: 'Protected blog',
                author: 'Author',
                url: 'http://example.com',
                likes: 3,
                user: userA._id,
            }

            const createdBlog = await api
                .post('/api/blogs')
                .set('Authorization', `Bearer ${tokenA}`)
                .send(newBlog)
                .expect(201)
                .expect('Content-Type', /application\/json/)

            await api
                .delete(`/api/blogs/${createdBlog.body.id}`)
                .set('Authorization', `Bearer ${tokenB}`)
                .expect(403)

            const blogsAtEnd = await helper.blogsInDb()
            assert(blogsAtEnd.map((b) => b.title).includes('Protected blog'))
            assert.strictEqual(
                blogsAtEnd.length,
                helper.initialBlogs.length + 1
            )
        })
    })
})

after(async () => {
    await mongoose.connection.close()
})
