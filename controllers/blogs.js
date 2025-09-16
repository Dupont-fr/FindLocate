const blogsRouter = require('express').Router()
const Blog = require('./../models/blog')
const { userExtractor } = require('./../utils/middleware')

blogsRouter.get('/', async (request, response) => {
    const blogs = await Blog.find({}).populate('user', { username: 1, name: 1 })
    response.json(blogs)
})

blogsRouter.get('/:id', async (request, response) => {
    const blog = await Blog.findById(request.params.id)
    if (blog) {
        response.json(blog)
    } else {
        response.status(404).end()
    }
})

blogsRouter.post('/', userExtractor, async (request, response) => {
    const body = request.body

    const user = request.user

    const blog = new Blog({
        title: body.title,
        author: body.author,
        url: body.url,
        likes: body.likes,
        user: user._id,
    })

    const savedBlog = await blog.save()

    user.blogs = user.blogs.concat(savedBlog._id)
    await user.save()

    response.status(201).json(savedBlog)
})

blogsRouter.put('/:id', async (request, response) => {
    const { likes } = request.body

    const blog = await Blog.findById(request.params.id)
    if (!blog) {
        return response.status(404).json({
            message: 'Le blog a déjà été supprimée du serveur.',
        })
    }

    blog.likes = likes
    const updatedBlog = await blog.save()
    response.json(updatedBlog)
})

blogsRouter.delete('/:id', userExtractor, async (request, response) => {
    const blog = await Blog.findById(request.params.id)
    if (!blog) {
        return response.status(404).json({
            message: 'Le blog a déjà été supprimée du serveur.',
        })
    }

    const user = request.user

    if (blog.user.toString() !== user._id.toString()) {
        return response
            .status(403)
            .json({ error: 'only the creator can delete this blog' })
    }

    await Blog.findByIdAndDelete(request.params.id)
    response.status(204).end()
})

module.exports = blogsRouter
