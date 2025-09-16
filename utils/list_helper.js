const _ = require('lodash')

// const dummy = (blogs) => {
//     return 1
// }

const totalLikes = (blogs) => {
    return blogs.reduce((sum, blog) => sum + blog.likes, 0)
}

const favoriteBlog = (blogs) => {
    if (blogs.length === 0) return null

    return blogs.reduce((fav, blog) => (blog.likes > fav.likes ? blog : fav))
}

const mostBlogs = (blogs) => {
    if (_.isEmpty(blogs)) return null

    const authorCount = _.countBy(blogs, 'author')

    const topAuthor = _.maxBy(
        _.keys(authorCount),
        (author) => authorCount[author]
    )
    return {
        author: topAuthor,
        blogs: authorCount[topAuthor],
    }
}

const mostLikes = (blogs) => {
    if (_.isEmpty(blogs)) {
        return null
    }

    const grouped = _.groupBy(blogs, 'author')

    const authorLikes = _.map(grouped, (posts, author) => ({
        author: author,
        likes: _.sumBy(posts, 'likes'),
    }))

    return _.maxBy(authorLikes, 'likes')
}

module.exports = {
    // dummy,
    totalLikes,
    favoriteBlog,
    mostLikes,
    mostBlogs,
}
