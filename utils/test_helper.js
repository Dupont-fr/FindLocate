const Blog = require('../models/blog')
const User = require('../models/user')

const initialBlogs = [
    {
        title: 'Understanding MongoDB with Mongoose',
        author: 'Jane Smith',
        url: 'https://example.com/mongoose-guide',
        likes: 27,
    },

    {
        title: 'Introduction à Node.js',
        author: 'Arto Hellas',
        url: 'https://fullstackopen.com/nodejs',
        likes: 120,
    },
]

const nonExistingId = async () => {
    const blog = new Blog({
        title: 'Introduction à React',
        author: 'Arto Hellas',
        url: 'https://fullstack.com/nodejs',
        likes: 120,
    })
    await blog.save()
    await blog.deleteOne()

    return blog._id.toString()
}

const blogsInDb = async () => {
    const blogs = await Blog.find({})
    return blogs.map((blog) => blog.toJSON())
}

const usersInDb = async () => {
    const users = await User.find({})
    return users.map((user) => user.toJSON())
}

module.exports = {
    initialBlogs,
    nonExistingId,
    blogsInDb,
    usersInDb,
}
