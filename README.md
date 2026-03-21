## Personal site number... 4?
The phrase "Work smarter, not harder" applies really well to this. While I love building sites from the ground up with HTML and CSS, creating a new personal site every year from scratch isn't a great use of my time. 

My hope is that starting with a template and using a new technology (Jekyll) will allow me to reach a final product that I'm happy with and can evolve, rather than get thrown out in a year or so. Modularity and the ability to easily add new things are the goals.
___

# Building
There's two parts to building: Get the neccessary gem packages with `bundle install`, and then download the Yarn dev dependencies to build .

To work on the site I run `bundle exec jekyll serve && yarn run tailwind-dev`.

To regenerate the BOSS FIGHTS intro, loop, and outro assets together with the generated segment manifest, run `npm run boss-fights:splice`.

To expose that splicing step during commits, run `git config core.hooksPath .githooks` once in this repo.

# Tests
Run `npm test` to execute the unit tests.
