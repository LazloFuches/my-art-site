module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  eleventyConfig.addCollection("artworks", function(collectionApi) {
    const artworks = [];
    const projectPages = collectionApi.getFilteredByGlob("src/projects/*.njk")
      .filter(p => p.data.images && p.data.images.length > 0);

    for (const project of projectPages) {
      project.data.images.forEach((img, i) => {
        artworks.push({
          ...img,
          projectTitle: project.data.title,
          projectYear: project.data.year,
          projectSlug: project.fileSlug,
          index: i,
          total: project.data.images.length,
        });
      });
    }
    return artworks;
  });

  return {
    dir: {
      input: "src",
      output: "_site"
    }
  };
};