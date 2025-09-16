const { test, describe } = require('node:test')
const assert = require('node:assert')
const listHelper = require('./../utils/list_helper')

const listWithOneBlog = [
    {
        title: 'Go To Statement Considered Harmful',
        author: 'Edsger W. Dijkstra',
        likes: 5,
    },
]

const listWithManyBlogs = [
    { author: 'Robert C. Martin', likes: 5 },
    { author: 'Edsger W. Dijkstra', likes: 7 },
    { author: 'Robert C. Martin', likes: 10 },
    { author: 'Robert C. Martin', likes: 2 },
]

// test('dummy returns one', () => {
//     const blogs = []

//     const result = listHelper.dummy(blogs)
//     assert.strictEqual(result, 1)
// })

describe('total likes', () => {
    test('when list has only one blog, equals the likes of that', () => {
        const result = listHelper.totalLikes(listWithOneBlog)
        assert.strictEqual(result, 5)
    })

    test('when list has multiple blogs, equals sum of likes', () => {
        const result = listHelper.totalLikes(listWithManyBlogs)
        assert.strictEqual(result, 24)
    })

    test('when list is empty, equals zero', () => {
        const result = listHelper.totalLikes([])
        assert.strictEqual(result, 0)
    })
})

describe('favorite blog', () => {
    test('returns blog with most likes', () => {
        const result = listHelper.favoriteBlog(listWithManyBlogs)
        assert.deepStrictEqual(result, listWithManyBlogs[2])
    })

    test('returns null when list is empty', () => {
        const result = listHelper.favoriteBlog([])
        assert.strictEqual(result, null)
    })
})
describe('author with most blogs', () => {
    test('returns author with highest number of blogs', () => {
        const result = listHelper.mostBlogs(listWithManyBlogs)
        assert.deepStrictEqual(result, {
            author: 'Robert C. Martin',
            blogs: 3,
        })
    })

    test('returns null for empty list', () => {
        const result = listHelper.mostBlogs([])
        assert.strictEqual(result, null)
    })
})

describe('author with most likes', () => {
    test('returns author whose blogs have the most likes', () => {
        const result = listHelper.mostLikes(listWithManyBlogs)
        assert.deepStrictEqual(result, {
            author: 'Robert C. Martin',
            likes: 17,
        })
    })

    test('returns null for empty list', () => {
        const result = listHelper.mostLikes([])
        assert.strictEqual(result, null)
    })
})